// "use client";

// import {
//   forwardRef,
//   useEffect,
//   useImperativeHandle,
//   useRef,
//   useState,
//   useCallback,
// } from "react";
// import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
// import type { Result } from "@zxing/library";

// export type QrScannerHandle = { stop: () => void };

// type Props = {
//   onResult: (text: string, result: Result) => void;
//   onError?: (err: unknown) => void;
//   facingMode?: "environment" | "user";
//   className?: string;
//   height?: number | string;
//   /** If false, camera won’t start; toggling to false will stop camera. */
//   active?: boolean;
// };

// const pickDeviceId = async (
//   facingMode: "environment" | "user"
// ): Promise<string | undefined> => {
//   // enumerateDevices may have empty labels until permission is granted
//   const devices = await navigator.mediaDevices.enumerateDevices();
//   const videos = devices.filter((d) => d.kind === "videoinput") as MediaDeviceInfo[];
//   if (videos.length === 0) return undefined;

//   if (facingMode === "environment") {
//     const back = videos.find((d) => /back|rear|environment/i.test(d.label));
//     return (back ?? videos[0]).deviceId;
//   }
//   const front = videos.find((d) => /front|user/i.test(d.label));
//   return (front ?? videos[0]).deviceId;
// };

// const QrScanner = forwardRef<QrScannerHandle, Props>(function QrScanner(
//   {
//     onResult,
//     onError,
//     facingMode = "environment",
//     className,
//     height = 320,
//     active = true,
//   },
//   ref
// ) {
//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const controlsRef = useRef<IScannerControls | null>(null);
//   const [ready, setReady] = useState(false);

//   // keep callbacks stable
//   const onResultRef = useRef(onResult);
//   const onErrorRef = useRef(onError);
//   useEffect(() => {
//     onResultRef.current = onResult;
//   }, [onResult]);
//   useEffect(() => {
//     onErrorRef.current = onError;
//   }, [onError]);

//   const hardStop = useCallback(() => {
//     try {
//       controlsRef.current?.stop();
//     } catch {}
//     controlsRef.current = null;

//     const video = videoRef.current;
//     const stream = (video?.srcObject as MediaStream | null) ?? null;
//     if (stream) {
//       for (const t of stream.getTracks()) {
//         try {
//           t.stop();
//         } catch {}
//       }
//     }
//     if (video) {
//       try {
//         video.pause();
//       } catch {}
//       video.srcObject = null;
//       video.removeAttribute("src");
//       video.load?.();
//     }
//     setReady(false);
//   }, []);

//   useImperativeHandle(ref, () => ({ stop: hardStop }), [hardStop]);

//   useEffect(() => {
//     let cancelled = false;

//     const start = async () => {
//       if (!active) {
//         hardStop();
//         return;
//       }

//       try {
//         const video = videoRef.current;
//         if (!video) return;

//         // 1) Choose a device (best-effort)
//         let deviceId: string | undefined;
//         try {
//           deviceId = await pickDeviceId(facingMode);
//         } catch {
//           deviceId = undefined;
//         }

//         // 2) Request camera stream explicitly
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: deviceId
//             ? { deviceId: { exact: deviceId } }
//             : { facingMode: { ideal: facingMode } },
//           audio: false,
//         });

//         // 3) Attach and play
//         video.srcObject = stream;
//         await video.play().catch(() => { /* Safari may need a user gesture; decoding still works */ });

//         // Wait for metadata so dimensions are known
//         await new Promise<void>((resolve) => {
//           if (video.readyState >= 1 /* HAVE_METADATA */) return resolve();
//           const onLoaded = () => {
//             video.removeEventListener("loadedmetadata", onLoaded);
//             resolve();
//           };
//           video.addEventListener("loadedmetadata", onLoaded);
//         });

//         if (cancelled) {
//           for (const t of stream.getTracks()) t.stop();
//           return;
//         }

//         // 4) Let ZXing decode from the same element
//         const reader = new BrowserMultiFormatReader();
//         const controls = await reader.decodeFromVideoElement(
//           video,
//           (res /* Result | undefined */, _err /* Exception | undefined */) => {
//             if (cancelled) return;
//             if (res) {
//               onResultRef.current?.(res.getText(), res);
//             }
//             // ignore continuous misses
//           }
//         );

//         if (cancelled) {
//           controls.stop();
//           return;
//         }

//         controlsRef.current = controls;
//         setReady(true);
//       } catch (e) {
//         onErrorRef.current?.(e);
//       }
//     };

//     start();

//     return () => {
//       cancelled = true;
//       hardStop();
//     };
//   }, [active, facingMode, hardStop]);

//   return (
//     <div className={className}>
//       <video
//         ref={videoRef}
//         className="w-full"
//         style={{ height, objectFit: "cover", background: "#000" }}
//         muted
//         playsInline
//         autoPlay
//       />
//       {!ready && active && (
//         <div className="text-sm text-zinc-500 p-2">Initializing camera…</div>
//       )}
//     </div>
//   );
// });

// export default QrScanner;