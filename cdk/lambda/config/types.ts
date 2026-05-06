// Configuration types
export interface CommonConfig {
  bucket: string | undefined;
  region: string;
  modelId: string;
  corsHeaders: {
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Credentials': string;
  };
  mockData: {
    [key: string]: any;
  } | null;
}

// Add other interfaces as needed