"use client";

// Music stored on the phone (Android app only). See
// native/android/LocalMusicPlugin.java and PlaybackService.java.
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type LocalTrack = {
  uri: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // ms
  added: number; // ms since epoch
};

export type LocalState = {
  uri?: string;
  title?: string;
  artist?: string;
  album?: string;
  playing?: boolean;
  position?: number;
  duration?: number;
  index?: number;
  count?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  shuffle?: boolean;
  repeat?: "off" | "all" | "one";
};

type Permission = "granted" | "denied" | "prompt" | "prompt-with-rationale";

type LocalMusicPlugin = {
  checkAudio(): Promise<{ audio: Permission }>;
  requestAudio(): Promise<{ audio: Permission }>;
  listTracks(): Promise<{ tracks: LocalTrack[] }>;
  artwork(opts: { uri: string }): Promise<{ path?: string }>;
  getState(): Promise<LocalState>;
  play(opts: { tracks: LocalTrack[]; index: number }): Promise<LocalState>;
  toggle(): Promise<LocalState>;
  next(): Promise<LocalState>;
  previous(): Promise<LocalState>;
  seek(opts: { position: number }): Promise<LocalState>;
  setShuffle(opts: { on: boolean }): Promise<LocalState>;
  setRepeat(opts: { mode: "off" | "all" | "one" }): Promise<LocalState>;
  addListener(event: "state", fn: (s: LocalState) => void): Promise<PluginListenerHandle>;
};

export const LocalMusic = registerPlugin<LocalMusicPlugin>("LocalMusic");
