// Debug logger utility with log storage
interface LogEntry {
  timestamp: number;
  category: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Prevent memory issues

  private addLog(level: 'info' | 'warn' | 'error', category: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      category,
      level,
      message,
      data
    };

    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  info = (category: string, message: string, data?: any) => {
    console.log(`[${category}] ${message}`, data || '');
    this.addLog('info', category, message, data);
  };

  warn = (category: string, message: string, data?: any) => {
    console.warn(`[${category}] ${message}`, data || '');
    this.addLog('warn', category, message, data);
  };

  error = (category: string, message: string, error?: any) => {
    console.error(`[${category}] ${message}`, error || '');
    this.addLog('error', category, message, error);
  };

  getLogs = () => {
    return [...this.logs];
  };

  exportLogs = () => {
    return JSON.stringify(this.logs, null, 2);
  };

  clearLogs = () => {
    this.logs = [];
  };
}

export const debugLogger = new DebugLogger();

// Performance monitor utility with checkpoint support
export const createPerformanceMonitor = (operation: string) => {
  const startTime = performance.now();
  const checkpoints: { name: string; time: number; duration: number }[] = [];
  let lastCheckpointTime = startTime;
  
  return {
    checkpoint: (name: string) => {
      const currentTime = performance.now();
      const duration = currentTime - lastCheckpointTime;
      checkpoints.push({
        name,
        time: currentTime,
        duration
      });
      lastCheckpointTime = currentTime;
      debugLogger.info('PERFORMANCE', `${operation} - ${name}: ${duration.toFixed(2)}ms`);
    },
    
    end: () => {
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      debugLogger.info('PERFORMANCE', `${operation} completed in ${totalDuration.toFixed(2)}ms`, {
        checkpoints,
        totalDuration
      });
      return totalDuration;
    },
    
    complete: function() {
      return this.end();
    }
  };
};

// File validation utility
export const validateFileUpload = (file: File, options?: {
  maxSize?: number;
  allowedTypes?: string[];
}) => {
  const maxSize = options?.maxSize || 5 * 1024 * 1024; // 5MB default
  const allowedTypes = options?.allowedTypes || ['image/jpeg', 'image/png', 'image/webp'];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }

  return { valid: true };
};

// Network request interceptor utility
export const interceptNetworkRequests = () => {
  debugLogger.info('NETWORK', 'Network request interception enabled');
  
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch to log requests
  window.fetch = async (...args) => {
    const [url, options] = args;
    const method = options?.method || 'GET';
    
    debugLogger.info('NETWORK', `${method} ${url}`);
    
    try {
      const response = await originalFetch(...args);
      debugLogger.info('NETWORK', `${method} ${url} - ${response.status}`);
      return response;
    } catch (error) {
      debugLogger.error('NETWORK', `${method} ${url} - Failed`, error);
      throw error;
    }
  };

  // Return cleanup function
  return () => {
    window.fetch = originalFetch;
    debugLogger.info('NETWORK', 'Network request interception disabled');
  };
};

// Database connection test utility
export const testDatabaseConnection = async () => {
  debugLogger.info('DB_TEST', 'Testing database connection...');
  
  try {
    const { supabase } = await import('./supabase');
    
    // Test basic connection with a simple query
    const { data, error } = await supabase
      .from('categories')
      .select('count')
      .limit(1);
    
    if (error) {
      debugLogger.error('DB_TEST', 'Database connection failed', error);
      return { success: false, error };
    }
    
    debugLogger.info('DB_TEST', 'Database connection successful');
    return { success: true, data };
  } catch (error) {
    debugLogger.error('DB_TEST', 'Database connection test failed', error);
    return { success: false, error };
  }
};

export const diagnoseBucketAccess = async () => {
  debugLogger.info('BUCKET_DIAG', 'Starting bucket diagnostics');

  try {
    const { supabase } = await import('./supabase');

    // Log Supabase instance info
    debugLogger.info('BUCKET_DIAG', 'Supabase client initialized', {
      url: supabase?.supabaseUrl || 'unknown',
    });

    // Test 1: List buckets
    debugLogger.info('BUCKET_DIAG', 'Testing bucket listing...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      debugLogger.error('BUCKET_DIAG', 'Failed to list buckets', listError);
      return { success: false, error: listError };
    }

    if (!buckets || buckets.length === 0) {
      debugLogger.warn('BUCKET_DIAG', 'No buckets returned. Possible auth/policy issue.');
    } else {
      debugLogger.info('BUCKET_DIAG', 'Available buckets:', buckets.map(b => b.name));
    }

    // Test 2: Check if product-images bucket exists
    const productImagesBucket = buckets?.find(b => b.name === 'product-images');
    if (!productImagesBucket) {
      debugLogger.error('BUCKET_DIAG', 'product-images bucket not found', {
        foundBuckets: buckets?.map(b => b.name) || [],
      });
      return { success: false, error: 'Bucket not found' };
    }

    debugLogger.info('BUCKET_DIAG', 'product-images bucket found', productImagesBucket);

    // Test 3: Test file upload
    debugLogger.info('BUCKET_DIAG', 'Testing file upload...');
    const testFile = new Blob(['test'], { type: 'text/plain' });
    const testPath = `test/diagnostic-${Date.now()}.txt`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(testPath, testFile);

    if (uploadError) {
      debugLogger.error('BUCKET_DIAG', 'Test upload failed', uploadError);
      return { success: false, error: uploadError };
    }

    debugLogger.info('BUCKET_DIAG', 'Test upload successful', uploadData);

    // Test 4: Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(uploadData.path);

    debugLogger.info('BUCKET_DIAG', 'Public URL generated', { publicUrl });

    // Test 5: Clean up test file
    await supabase.storage
      .from('product-images')
      .remove([uploadData.path]);

    debugLogger.info('BUCKET_DIAG', 'Test file cleaned up');

    return { success: true };
  } catch (error) {
    debugLogger.error('BUCKET_DIAG', 'Bucket diagnostics failed', error);
    return { success: false, error };
  }
};