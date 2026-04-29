import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export function useForegroundLocation() {
  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const watchRef = useRef(null);

  const stopWatching = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    stopWatching();
  }, [stopWatching]);

  const requestPermission = useCallback(async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === 'granted') {
        setPermissionStatus('granted');
        return true;
      }

      setPermissionStatus('requesting');
      const requested = await Location.requestForegroundPermissionsAsync();
      if (requested.status === 'granted') {
        setPermissionStatus('granted');
        return true;
      }

      setPermissionStatus('denied');
      return false;
    } catch {
      setPermissionStatus('error');
      return false;
    }
  }, []);

  const requestCurrentLocation = useCallback(async () => {
    setLoading(true);
    try {
      const allowed = await requestPermission();
      if (!allowed) return null;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const nextCoords = {
        lat: Number(position.coords.latitude),
        lng: Number(position.coords.longitude),
      };
      setCoords(nextCoords);
      setPermissionStatus('granted');
      return nextCoords;
    } catch {
      setPermissionStatus('error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [requestPermission]);

  const startWatching = useCallback(async (onUpdate) => {
    const allowed = await requestPermission();
    if (!allowed) return false;

    stopWatching();
    try {
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 8,
        },
        (position) => {
          const nextCoords = {
            lat: Number(position.coords.latitude),
            lng: Number(position.coords.longitude),
          };
          setCoords(nextCoords);
          setPermissionStatus('granted');
          if (typeof onUpdate === 'function') {
            onUpdate(nextCoords);
          }
        }
      );
      return true;
    } catch {
      setPermissionStatus('error');
      return false;
    }
  }, [requestPermission, stopWatching]);

  return {
    permissionStatus,
    coords,
    loading,
    requestPermission,
    requestCurrentLocation,
    startWatching,
    stopWatching,
    setCoords,
  };
}
