import * as Location from 'expo-location';
import { GeoLocation } from '../../models/Photo';

export interface LocationSnapshot {
  location: GeoLocation | null;
  address: string | null;
}

class LocationService {
  private cachedLocation: GeoLocation | null = null;
  private cachedAddress: string | null = null;
  private permissionStatus: 'undetermined' | 'granted' | 'denied' | 'unavailable' = 'undetermined';
  private locationSubscription: Location.LocationSubscription | null = null;
  private isFetching = false;
  private isReverseGeocoding = false;
  // True only while a screen (the camera) actually wants live updates.
  private watchRequested = false;
  private watchStarting = false;
  private addressCache = new Map<string, string>();

  /**
   * Checks or requests foreground location permissions.
   */
  async requestPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) {
        this.permissionStatus = 'granted';
        // Immediately fetch last known position and start background watcher
        await this.initLocationPipeline();
        return 'granted';
      } else {
        this.permissionStatus = 'denied';
        return 'denied';
      }
    } catch (error) {
      console.warn('[LocationService] Permission request failed:', error);
      this.permissionStatus = 'unavailable';
      return 'unavailable';
    }
  }

  /**
   * Initializes immediate location acquisition and starts continuous background tracking.
   */
  private async initLocationPipeline(): Promise<void> {
    // 1. Instantly check last known position (near 0ms latency)
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown?.coords) {
        this.updateCoordinates(lastKnown.coords);
      }
    } catch {
      // Non-fatal
    }

    // 2. Start continuous watcher only if a screen asked for live updates
    if (this.watchRequested) {
      this.startWatching();
    }

    // 3. Eagerly trigger a balanced one-shot fetch in background
    this.fetchCurrentPosition();
  }

  /**
   * Updates cached coordinates and triggers background reverse geocoding.
   */
  private updateCoordinates(coords: Location.LocationObjectCoords): void {
    this.cachedLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude,
      accuracy: coords.accuracy,
    };

    // Asynchronously resolve human-readable address in background
    this.resolveAddressInBackground(coords.latitude, coords.longitude);
  }

  /**
   * Starts continuous location watcher with balanced accuracy.
   */
  async startWatching(): Promise<void> {
    this.watchRequested = true;
    if (this.locationSubscription || this.watchStarting || this.permissionStatus !== 'granted') {
      return;
    }

    this.watchStarting = true;
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (pos) => {
          if (pos?.coords) {
            this.updateCoordinates(pos.coords);
          }
        }
      );
      if (this.watchRequested) {
        this.locationSubscription = subscription;
      } else {
        // stopWatching() was called while the subscription was being created.
        subscription.remove();
      }
    } catch (error) {
      console.warn('[LocationService] watchPositionAsync failed:', error);
    } finally {
      this.watchStarting = false;
    }
  }

  /**
   * Stops continuous location watcher to conserve battery.
   */
  stopWatching(): void {
    this.watchRequested = false;
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  /**
   * One-shot balanced location fetch in background.
   */
  private async fetchCurrentPosition(): Promise<void> {
    if (this.isFetching || this.permissionStatus !== 'granted') {
      return;
    }

    this.isFetching = true;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (pos?.coords) {
        this.updateCoordinates(pos.coords);
      }
    } catch (error) {
      // Non-fatal: offline or temporary GPS timeout
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Returns the current permission status.
   */
  getPermissionStatus(): 'undetermined' | 'granted' | 'denied' | 'unavailable' {
    return this.permissionStatus;
  }

  /**
   * Immediately returns the latest cached location snapshot (instant, non-blocking).
   */
  getLatestLocationSnapshot(): LocationSnapshot {
    if (this.permissionStatus === 'denied' || this.permissionStatus === 'unavailable') {
      return { location: null, address: null };
    }

    const loc = this.cachedLocation;
    return {
      location: loc ? { ...loc } : null,
      address: this.cachedAddress,
    };
  }

  /**
   * Robust background fallback: if cached location was null at shutter tap,
   * awaits a quick GPS fix (with a strict timeout) in the background persistence worker.
   * This NEVER blocks the shutter button or camera UI.
   */
  async ensureLocation(timeoutMs = 2500): Promise<LocationSnapshot> {
    // If we already have coordinates, return immediately
    const existing = this.cachedLocation;
    if (existing) {
      return {
        location: { ...existing },
        address: this.cachedAddress,
      };
    }

    if (this.permissionStatus !== 'granted') {
      return { location: null, address: null };
    }

    // Attempt rapid last-known position first
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown?.coords) {
        this.updateCoordinates(lastKnown.coords);
        const updated = this.cachedLocation;
        return {
          location: updated ? { ...updated } : null,
          address: this.cachedAddress,
        };
      }
    } catch {
      // Continue to timeout-bounded fetch
    }

    // Attempt bounded getCurrentPositionAsync
    try {
      const fetchPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      if (result && 'coords' in result && result.coords) {
        this.updateCoordinates(result.coords);
        const updated = this.cachedLocation;
        return {
          location: updated ? { ...updated } : null,
          address: this.cachedAddress,
        };
      }
    } catch {
      // Non-fatal
    }

    const finalLoc = this.cachedLocation;
    return {
      location: finalLoc ? { ...finalLoc } : null,
      address: this.cachedAddress,
    };
  }

  /**
   * Non-blocking reverse geocoding with in-memory caching and offline safety.
   */
  async resolveAddressInBackground(
    latitude: number,
    longitude: number
  ): Promise<string | null> {
    const coordKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    if (this.addressCache.has(coordKey)) {
      const cached = this.addressCache.get(coordKey)!;
      this.cachedAddress = cached;
      return cached;
    }

    if (this.isReverseGeocoding) {
      return null;
    }

    this.isReverseGeocoding = true;
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const item = results[0];
        const parts: string[] = [];

        const street = [item.streetNumber, item.street].filter(Boolean).join(' ');
        if (street) parts.push(street);
        if (item.city) parts.push(item.city);
        if (item.region) parts.push(item.region);
        if (item.postalCode) parts.push(item.postalCode);
        if (item.country) parts.push(item.country);

        const formattedAddress = parts.join(', ') || null;
        if (formattedAddress) {
          this.addressCache.set(coordKey, formattedAddress);
          this.cachedAddress = formattedAddress;
          return formattedAddress;
        }
      }
    } catch {
      // Silent offline / timeout fallback: retain GPS coordinates without address
    } finally {
      this.isReverseGeocoding = false;
    }

    return null;
  }
}

export const locationService = new LocationService();
