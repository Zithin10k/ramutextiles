import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {v4} from 'uuid'
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  X,
  Image as ImageIcon,
  Bug,
  Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useForm } from 'react-hook-form';
import { ImageUploader, UploadedImage } from '../../components/ui/ImageUploader';
import { uploadProductImages, deleteProductImage } from '../../lib/supabaseStorage';
import { 
  debugLogger, 
  interceptNetworkRequests, 
  diagnoseBucketAccess, 
  testDatabaseConnection,
  createPerformanceMonitor 
} from '../../lib/debugUtils';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  compare_price?: number;
  short_description?: string;
  description?: string;
  stock_count: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  category_id?: string;
  product_media: Array<{
    id: string;
    url: string;
    media_type: 'image' | 'video';
    is_primary: boolean;
  }>;
  categories?: {
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
}

interface ProductFormData {
  name: string;
  price: number;
  compare_price?: number;
  short_description?: string;
  description?: string;
  stock_count: number;
  category_id?: string;
  is_active: boolean;
  is_featured: boolean;
}

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productImages, setProductImages] = useState<UploadedImage[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string>('');
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFormData>();

  useEffect(() => {
    // Initialize debugging
    interceptNetworkRequests();
    debugLogger.info('INIT', 'Admin Products Page initialized');
    
    loadProducts();
    loadCategories();
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    debugLogger.info('DIAGNOSTICS', 'Running system diagnostics...');
    
    // Test database connection
    const dbTest = await testDatabaseConnection();
    if (!dbTest.success) {
      toast.error('Database connection failed');
    }
    
    // Test bucket access
    const bucketTest = await diagnoseBucketAccess();
    if (!bucketTest.success) {
      toast.error('Storage bucket access failed');
    }
    
    debugLogger.info('DIAGNOSTICS', 'Diagnostics completed', {
      database: dbTest.success,
      storage: bucketTest.success
    });
  };

  const loadProducts = async () => {
    const monitor = createPerformanceMonitor('loadProducts');
    
    try {
      debugLogger.info('LOAD_PRODUCTS', 'Starting to load products');
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          compare_price,
          short_description,
          description,
          stock_count,
          is_active,
          is_featured,
          created_at,
          category_id,
          product_media (
            id,
            url,
            media_type,
            is_primary
          ),
          categories (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        debugLogger.error('LOAD_PRODUCTS', 'Failed to load products', error);
        throw error;
      }
      
      debugLogger.info('LOAD_PRODUCTS', `Loaded ${data?.length || 0} products`);
      setProducts(data || []);
      monitor.complete();
    } catch (error) {
      debugLogger.error('LOAD_PRODUCTS', 'Error loading products', error);
      toast.error('Failed to load products');
      monitor.complete();
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      debugLogger.info('LOAD_CATEGORIES', 'Loading categories');
      
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        debugLogger.error('LOAD_CATEGORIES', 'Failed to load categories', error);
        throw error;
      }
      
      debugLogger.info('LOAD_CATEGORIES', `Loaded ${data?.length || 0} categories`);
      setCategories(data || []);
    } catch (error) {
      debugLogger.error('LOAD_CATEGORIES', 'Error loading categories', error);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.short_description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateProduct = () => {
    debugLogger.info('FORM', 'Opening create product form');
    setEditingProduct(null);
    setProductImages([]);
    setSubmitStatus('');
    reset({
      name: '',
      price: 0,
      compare_price: undefined,
      short_description: '',
      description: '',
      stock_count: 0,
      category_id: '',
      is_active: true,
      is_featured: false,
    });
    setShowModal(true);
  };

  const handleEditProduct = (product: Product) => {
    debugLogger.info('FORM', 'Opening edit product form', { productId: product.id });
    setEditingProduct(product);
    setProductImages([]);
    setSubmitStatus('');
    reset({
      name: product.name,
      price: product.price,
      compare_price: product.compare_price,
      short_description: product.short_description || '',
      description: product.description || '',
      stock_count: product.stock_count,
      category_id: product.category_id || '',
      is_active: product.is_active,
      is_featured: product.is_featured,
    });
    setShowModal(true);
  };

  const onSubmit = async (data: ProductFormData) => {
    const monitor = createPerformanceMonitor('productSubmission');
    
    // Validate that we have images for new products
    if (!editingProduct && productImages.length === 0) {
      debugLogger.warn('FORM_VALIDATION', 'No images provided for new product');
      toast.error('Please add at least one product image');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('Initializing...');
    
    try {
      debugLogger.info('FORM_SUBMIT', 'Starting form submission', {
        isEdit: !!editingProduct,
        productId: editingProduct?.id,
        imageCount: productImages.length,
        formData: data
      });

      monitor.checkpoint('validation-start');
      setSubmitStatus('Validating data...');
      
      // Process data to handle empty strings and null values for numeric fields
      const processedData = {
        ...data,
        category_id: data.category_id === '' ? null : data.category_id,
        compare_price: data.compare_price === '' || data.compare_price === undefined || data.compare_price === 0 
          ? null 
          : Number(data.compare_price),
        price: Number(data.price),
        stock_count: Number(data.stock_count),
      };

      debugLogger.info('FORM_SUBMIT', 'Data processed', processedData);
      monitor.checkpoint('validation-complete');

      let productId: string;

      if (editingProduct) {
        // Update existing product
        setSubmitStatus('Updating product...');
        monitor.checkpoint('update-start');
        
        debugLogger.info('PRODUCT_UPDATE', 'Updating existing product', {
          productId: editingProduct.id,
          changes: processedData
        });
        
        const { error } = await supabase
          .from('products')
          .update({
            ...processedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (error) {
          debugLogger.error('PRODUCT_UPDATE', 'Update failed', error);
          throw error;
        }
        
        productId = editingProduct.id;
        debugLogger.info('PRODUCT_UPDATE', 'Product updated successfully');
        monitor.checkpoint('update-complete');
      } else {
        // Create new product
        setSubmitStatus('Creating product...');
        monitor.checkpoint('create-start');
        
        const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')+ v4();
        const createData = {
          ...processedData,
          slug,
        };
        
        debugLogger.info('PRODUCT_CREATE', 'Creating new product', createData);
        
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert(createData)
          .select('id')
          .single();

        if (error) {
          debugLogger.error('PRODUCT_CREATE', 'Create failed', error);
          throw error;
        }
        
        productId = newProduct.id;
        debugLogger.info('PRODUCT_CREATE', 'Product created successfully', { productId });
        monitor.checkpoint('create-complete');
      }

      // Upload images if any
      if (productImages.length > 0) {
        setSubmitStatus(`Preparing to upload ${productImages.length} images...`);
        monitor.checkpoint('image-upload-start');
        
        debugLogger.info('IMAGE_UPLOAD', 'Starting image upload process', {
          productId,
          imageCount: productImages.length,
          images: productImages.map(img => ({
            name: img.file.name,
            size: img.file.size,
            type: img.file.type
          }))
        });
        
        // Convert UploadedImage[] to File[]
        const files = productImages.map(img => img.file);
        
        // Upload images to Supabase Storage
        const uploadResults = await uploadProductImages(
          files,
          productId,
          (index, progress) => {
            const statusMessage = `Uploading image ${index + 1}/${files.length}... ${progress.progress}% (${progress.stage})`;
            setSubmitStatus(statusMessage);
            
            debugLogger.info('IMAGE_UPLOAD_PROGRESS', statusMessage, {
              index,
              progress: progress.progress,
              stage: progress.stage
            });
            
            // Update progress in UI
            setProductImages(prev => prev.map((img, i) => 
              i === index ? { ...img, uploadProgress: progress.progress } : img
            ));
          }
        );

        monitor.checkpoint('image-upload-complete');
        debugLogger.info('IMAGE_UPLOAD', 'Upload results received', {
          totalUploads: uploadResults.length,
          results: uploadResults.map(r => ({ url: r.url, error: r.error }))
        });

        // Check for upload failures
        const failedUploads = uploadResults.filter(r => r.error);
        const successfulUploads = uploadResults.filter(r => !r.error && r.url);

        if (failedUploads.length > 0) {
          debugLogger.error('IMAGE_UPLOAD', 'Some uploads failed', {
            failedCount: failedUploads.length,
            failures: failedUploads.map(r => r.error)
          });
        }

        if (successfulUploads.length === 0) {
          debugLogger.error('IMAGE_UPLOAD', 'All uploads failed');
          throw new Error('All image uploads failed');
        }

        // Insert media records into database
        setSubmitStatus('Saving image records to database...');
        monitor.checkpoint('media-records-start');
        
        debugLogger.info('MEDIA_RECORDS', 'Inserting media records', {
          productId,
          successfulUploads: successfulUploads.length
        });
        
        const mediaInserts = [];
        for (let i = 0; i < uploadResults.length; i++) {
          const result = uploadResults[i];
          
          if (result.error || !result.url) {
            debugLogger.warn('MEDIA_RECORDS', `Skipping failed upload ${i + 1}`, result.error);
            continue;
          }

          try {
            const mediaRecord = {
              product_id: productId,
              media_type: 'image' as const,
              url: result.url,
              is_primary: i === 0, // First image is primary
              display_order: i,
              alt_text: `${data.name} - Image ${i + 1}`,
            };

            debugLogger.info('MEDIA_RECORDS', `Inserting media record ${i + 1}`, mediaRecord);

            const { error: mediaError } = await supabase
              .from('product_media')
              .insert(mediaRecord);

            if (mediaError) {
              debugLogger.error('MEDIA_RECORDS', `Failed to insert media record ${i + 1}`, mediaError);
              
              // Clean up uploaded file if database insert fails
              if (result.path) {
                debugLogger.info('CLEANUP', `Cleaning up failed upload: ${result.path}`);
                await deleteProductImage(result.path);
              }
              throw mediaError;
            } else {
              debugLogger.info('MEDIA_RECORDS', `Media record ${i + 1} inserted successfully`);
              mediaInserts.push(result);
            }
          } catch (error) {
            debugLogger.error('MEDIA_RECORDS', `Error processing media record ${i + 1}`, error);
            throw error;
          }
        }

        monitor.checkpoint('media-records-complete');

        if (mediaInserts.length === 0) {
          debugLogger.error('MEDIA_RECORDS', 'No media records were saved');
          throw new Error('Failed to save any image records to database');
        }

        if (successfulUploads.length < uploadResults.length) {
          const message = `${successfulUploads.length} of ${uploadResults.length} images uploaded successfully`;
          debugLogger.warn('IMAGE_UPLOAD', message);
          toast.warning(message);
        }

        debugLogger.info('MEDIA_RECORDS', 'All media records processed successfully', {
          totalRecords: mediaInserts.length
        });
      }

      setSubmitStatus('Finalizing...');
      monitor.checkpoint('finalization-start');
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      const successMessage = editingProduct ? 'Product updated successfully' : 'Product created successfully';
      debugLogger.info('FORM_SUBMIT', 'Form submission completed successfully');
      
      toast.success(successMessage);
      setShowModal(false);
      setProductImages([]);
      setSubmitStatus('');
      loadProducts();
      
      monitor.complete();
      
    } catch (error) {
      debugLogger.error('FORM_SUBMIT', 'Form submission failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      setSubmitStatus('');
      monitor.complete();
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          toast.error('A product with this name or SKU already exists');
        } else if (error.message.includes('upload')) {
          toast.error('Failed to upload images. Please try again.');
        } else if (error.message.includes('database')) {
          toast.error('Database error. Please check your data and try again.');
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } else {
        toast.error('Failed to save product. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      debugLogger.info('PRODUCT_DELETE', 'Deleting product', { productId });
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('Product deleted successfully');
      
      debugLogger.info('PRODUCT_DELETE', 'Product deleted successfully');
    } catch (error) {
      debugLogger.error('PRODUCT_DELETE', 'Failed to delete product', error);
      toast.error('Failed to delete product');
    }
  };

  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      debugLogger.info('PRODUCT_STATUS', 'Toggling product status', {
        productId,
        currentStatus,
        newStatus: !currentStatus
      });
      
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, is_active: !currentStatus } : p
      ));

      toast.success(`Product ${!currentStatus ? 'activated' : 'deactivated'}`);
      debugLogger.info('PRODUCT_STATUS', 'Status updated successfully');
    } catch (error) {
      debugLogger.error('PRODUCT_STATUS', 'Failed to update status', error);
      toast.error('Failed to update product status');
    }
  };

  const exportDebugLogs = () => {
    const logs = debugLogger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Debug Panel Toggle */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Toggle Debug Panel"
        >
          <Bug className="w-5 h-5" />
        </button>
      </div>

      {/* Debug Panel */}
      <AnimatePresence>
        {showDebugPanel && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 w-96 h-full bg-gray-900 text-white p-4 overflow-y-auto z-50 border-l border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Debug Panel</h3>
              <div className="flex space-x-2">
                <button
                  onClick={exportDebugLogs}
                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  title="Export Logs"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDebugPanel(false)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={runDiagnostics}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors"
              >
                Run Diagnostics
              </button>
              
              <div className="bg-gray-800 p-3 rounded text-xs">
                <h4 className="font-bold mb-2">Recent Logs:</h4>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {debugLogger.getLogs().slice(-20).map((log, index) => (
                    <div key={index} className={`text-xs ${
                      log.level === 'error' ? 'text-red-400' : 
                      log.level === 'warn' ? 'text-yellow-400' : 'text-blue-400'
                    }`}>
                      <span className="text-gray-400">[{log.category}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-2">Manage your product catalog</p>
        </div>
        
        <button
          onClick={handleCreateProduct}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="lg:w-64">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price (INR)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-4">
                      {product.product_media?.find(m => m.is_primary) ? (
                        <img
                          src={product.product_media.find(m => m.is_primary)?.url}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        {product.short_description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {product.short_description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {product.categories?.name || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(product.price)}
                      </span>
                      {product.compare_price && product.compare_price > product.price && (
                        <span className="ml-2 text-sm text-gray-500 line-through">
                          {formatCurrency(product.compare_price)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`font-medium ${
                      product.stock_count > 10 ? 'text-green-600' : 
                      product.stock_count > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {product.stock_count}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        product.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {product.is_featured && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          Featured
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => toggleProductStatus(product.id, product.is_active)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {product.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </div>

      {/* Product Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingProduct ? 'Edit Product' : 'Create Product'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Image Upload Section */}
                  <div>
                    <ImageUploader
                      images={productImages}
                      onImagesChange={setProductImages}
                      maxImages={5}
                      allowReorder={true}
                      allowMainSelection={false}
                    />
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name *
                      </label>
                      <input
                        {...register('name', { required: 'Product name is required' })}
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter product name"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </label>
                      <select
                        {...register('category_id')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price (INR) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                        <input
                          {...register('price', { 
                            required: 'Price is required',
                            min: { value: 0, message: 'Price must be positive' }
                          })}
                          type="number"
                          step="0.01"
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="1499"
                        />
                      </div>
                      {errors.price && (
                        <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Compare Price (INR)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                        <input
                          {...register('compare_price', {
                            min: { value: 0, message: 'Price must be positive' }
                          })}
                          type="number"
                          step="0.01"
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="1999"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stock Count *
                      </label>
                      <input
                        {...register('stock_count', { 
                          required: 'Stock count is required',
                          min: { value: 0, message: 'Stock must be non-negative' }
                        })}
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="100"
                      />
                      {errors.stock_count && (
                        <p className="mt-1 text-sm text-red-600">{errors.stock_count.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Descriptions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Short Description
                    </label>
                    <input
                      {...register('short_description')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Brief description for product cards"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Description
                    </label>
                    <textarea
                      {...register('description')}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Detailed product description"
                    />
                  </div>

                  {/* Settings */}
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center">
                      <input
                        {...register('is_active')}
                        type="checkbox"
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Product is active</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        {...register('is_featured')}
                        type="checkbox"
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Featured product</span>
                    </label>
                  </div>

                  {/* Submit Status */}
                  {submitStatus && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3" />
                        <span className="text-blue-800 font-medium">{submitStatus}</span>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      disabled={isSubmitting}
                      className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          {submitStatus || (editingProduct ? 'Updating...' : 'Creating...')}
                        </div>
                      ) : (
                        editingProduct ? 'Update Product' : 'Create Product'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};