import {
  pipeline,
  AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

// Simple state tracking
let modelLoaded = false;
let modelLoading = false;

type DeviceType = "webgpu" | "wasm";

// Device configurations with proper types
const PER_DEVICE_CONFIG = {
  webgpu: {
    device: "webgpu" as const,
    dtype: {
      encoder_model: "fp32" as const,
      decoder_model_merged: "q4" as const,
    } as Record<
      string,
      | "fp32"
      | "q4"
      | "q8"
      | "auto"
      | "fp16"
      | "int8"
      | "uint8"
      | "bnb4"
      | "q4f16"
    >,
  },
  wasm: {
    device: "wasm" as const,
    dtype: "q8" as const,
  },
};

// Create a single pipeline instance
let pipelineInstance: AutomaticSpeechRecognitionPipeline | null = null;

// Handle messages from the main thread
self.addEventListener("message", async (event: MessageEvent) => {
  const { type, data } = event.data;

  try {
    if (type === "load") {
      await handleLoad(data);
    } else if (type === "run") {
      await handleRun(data);
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error("Error in worker:", error);
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

// Handle model loading
async function handleLoad({ device = "wasm" }: { device?: DeviceType }) {
  console.log(`Worker: Starting to load model with device: ${device}`);

  // Prevent multiple concurrent loading attempts
  if (modelLoading) {
    console.log("Worker: Model is already loading");
    self.postMessage({
      status: "loading",
      data: "Model is already loading...",
    });
    return;
  }

  // If model is already loaded, just notify ready
  if (modelLoaded && pipelineInstance) {
    console.log("Worker: Model is already loaded");
    self.postMessage({ status: "ready" });
    return;
  }

  try {
    modelLoading = true;
    console.log("Worker: Set modelLoading = true");

    // Notify loading started
    self.postMessage({
      status: "loading",
      data: `Loading model (${device})...`,
    });

    console.log(`Worker: Using device configuration for ${device}`);
    const deviceConfig = PER_DEVICE_CONFIG[device];

    console.log("Worker: Creating pipeline");
    // Create the pipeline with the correctly typed device config
    pipelineInstance = await pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-base_timestamped",
      {
        ...deviceConfig,
        progress_callback: (progressInfo) => {
          console.log("Worker: Model loading progress", progressInfo);
          // Extract progress value based on the type
          let progressValue = 0;

          if (typeof progressInfo === "number") {
            progressValue = progressInfo;
          } else if (progressInfo) {
            // Handle different progress info formats
            if ("progress" in progressInfo) {
              progressValue = (progressInfo as { progress: number }).progress;
            } else if (
              "status" in progressInfo &&
              (progressInfo.status === "download" ||
                progressInfo.status === "ready")
            ) {
              // Use different progress values based on status
              progressValue = progressInfo.status === "download" ? 0.3 : 0.8;
            }
          }

          self.postMessage({
            status: "progress",
            data: { progress: progressValue * 0.5 }, // Scale to 0-0.5 range for model loading phase
          });
        },
      }
    );
    console.log("Worker: Pipeline created successfully");

    // Warm up with a small input
    if (device === "webgpu") {
      self.postMessage({
        status: "loading",
        data: "Compiling shaders and warming up model...",
      });

      console.log("Worker: Warming up model");
      await pipelineInstance(new Float32Array(16_000), {
        language: "en",
      });
      console.log("Worker: Model warmup complete");
    }

    // Mark as loaded
    modelLoaded = true;
    console.log("Worker: Set modelLoaded = true");
    self.postMessage({ status: "ready" });
    console.log("Worker: Sent ready status");
  } catch (error) {
    console.error("Worker: Error loading model:", error);
    modelLoaded = false;
    pipelineInstance = null;
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  } finally {
    modelLoading = false;
    console.log("Worker: Set modelLoading = false");
  }
}

// Handle transcription requests
async function handleRun({
  audio,
  language = "en",
}: {
  audio: Float32Array;
  language?: string;
}) {
  console.log(
    `Worker: Starting transcription with language: ${language}, audio length: ${audio.length}`
  );

  if (!modelLoaded || !pipelineInstance) {
    console.error("Worker: Model not loaded when trying to transcribe");
    self.postMessage({
      status: "error",
      data: "Model not loaded. Please load the model first.",
    });
    return;
  }

  try {
    console.log("Worker: Beginning transcription");
    const start = performance.now();

    // Run transcription with progress updates
    const result = await pipelineInstance(audio, {
      language,
      return_timestamps: "word",
      chunk_length_s: 30,
      // Transcription doesn't support progress callbacks in the same way
      // We'll rely on the completion event instead
    });

    const end = performance.now();
    console.log(`Worker: Transcription complete in ${end - start}ms`);

    // Send result back to main thread
    self.postMessage({
      status: "complete",
      result,
      time: end - start,
    });
  } catch (error) {
    console.error("Worker: Error in transcription:", error);
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
