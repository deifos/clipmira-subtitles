import {
  pipeline,
  AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

type DeviceType = "webgpu" | "wasm";

// Device configurations optimized like sample app
const PER_DEVICE_CONFIG = {
  webgpu: {
    dtype: {
      encoder_model: "fp32" as const,
      decoder_model_merged: "q4" as const,
    },
    device: "webgpu" as const,
  },
  wasm: {
    dtype: "q8" as const,
    device: "wasm" as const,
  },
};

/**
 * Simplified singleton pattern like the sample app
 */
class PipelineSingleton {
  static model_id = "onnx-community/whisper-base_timestamped";
  static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

  static async getInstance(
    progress_callback?: ((progress: any) => void),
    device: DeviceType = "webgpu"
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    if (!this.instance) {
      this.instance = pipeline(
        "automatic-speech-recognition",
        this.model_id,
        {
          ...PER_DEVICE_CONFIG[device],
          ...(progress_callback && { progress_callback }),
        }
      );
    }
    return this.instance;
  }
}

// Handle messages from the main thread - simplified like sample app
self.addEventListener("message", async (e: MessageEvent) => {
  const { type, data } = e.data;

  switch (type) {
    case "load":
      await handleLoad(data);
      break;

    case "run":
      await handleRun(data);
      break;

    default:
      console.error(`Unknown message type: ${type}`);
  }
});

// Handle model loading - simplified like sample app
async function handleLoad({ device = "wasm" }: { device?: DeviceType }) {
  self.postMessage({
    status: "loading",
    data: `Loading model (${device})...`,
  });

  try {
    // Load the pipeline and save it for future use
    const transcriber = await PipelineSingleton.getInstance(
      (progressInfo) => {
        // Forward progress directly like sample app
        self.postMessage(progressInfo);
      },
      device
    );

    // Warm up model if using WebGPU
    if (device === "webgpu") {
      self.postMessage({
        status: "loading",
        data: "Compiling shaders and warming up model...",
      });

      await transcriber(new Float32Array(16_000), {
        language: "en",
      });
    }

    self.postMessage({ status: "ready" });
  } catch (error) {
    console.error("Worker: Error loading model:", error);
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

// Handle transcription requests - optimized like sample app
async function handleRun({
  audio,
  language = "en",
}: {
  audio: Float32Array;
  language?: string;
}) {
  try {
    const transcriber = await PipelineSingleton.getInstance();
    const start = performance.now();

    // Use same settings as sample app for better performance
    const result = await transcriber(audio, {
      language,
      return_timestamps: "word",
      chunk_length_s: 30, // Increased from 15 to match sample app
      // Removed stride_length_s to match sample app
    });

    const end = performance.now();

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
