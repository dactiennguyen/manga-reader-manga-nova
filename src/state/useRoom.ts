/**
 * The room on this phone: host or join a Play-together room, send and receive messages and blobs.
 * All the logic is in src/core/nearby/room.ts; this file only plugs in the phone's real network.
 * Tests use createLoopbackPhones (src/core/nearby/loopback.ts) to get several phones in one process.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { parseRoomLink, roomLink } from '../core/nearby/link';
import { roomStateCreator, type RoomStoreState } from '../core/nearby/room';
import type { NearbyRoom } from '../core/nearby/types';
import { nativeDiscovery, nativeNetwork } from '../native/nearby';

export type { RoomStatus, RoomStoreState } from '../core/nearby/room';
export { parseRoomLink, roomLink };

export const useRoom = create<RoomStoreState>()(roomStateCreator({ network: nativeNetwork, discovery: nativeDiscovery }));

/** Rooms announced on this Wi-Fi, watched while the calling screen is mounted. Code-only rooms have no token. */
export function useNearbyRooms(): NearbyRoom[] {
  const [rooms, setRooms] = useState<NearbyRoom[]>([]);
  const browse = useRoom(state => state.browse);
  useEffect(() => browse(setRooms), [browse]);
  return rooms;
}

/** This phone's Wi-Fi address, for reading a typed room code (it supplies the first half of the host's). */
export function localWifiAddress(): Promise<string | null> {
  return nativeNetwork.localIPv4();
}
