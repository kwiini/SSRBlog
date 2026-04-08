declare module "nitropack" {
  interface NitroRuntimeConfig {
    llmApiKey: string;
    llmBaseURL: string;
    llmModel: string;
    embeddingModel: string;
  }
}

export {};
