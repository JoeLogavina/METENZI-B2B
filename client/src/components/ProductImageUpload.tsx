import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ProductImageUploadProps {
  productId: string;
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  className?: string;
}

export function ProductImageUpload({ 
  productId, 
  currentImageUrl, 
  onImageUploaded, 
  className = '' 
}: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (PNG, JPEG, GIF, WebP)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    
    try {
      // Create a FormData object
      const formData = new FormData();
      formData.append('productImage', file);
      formData.append('productId', productId);
      formData.append('altText', `Product image for ${productId}`);
      formData.append('category', 'product-images');

      // Upload to our enterprise image management system
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Handle the response format from enterprise image management system
      console.log('Upload response:', result);
      
      let newImageUrl = '';
      if (result.images && result.images.length > 0) {
        // Use the URL from the first uploaded image (this includes the full path)
        newImageUrl = result.images[0].url;
      } else if (result.data && result.data.filePath) {
        // Alternative response format
        newImageUrl = result.data.filePath;
      } else if (result.filePath) {
        // Direct filePath in response
        newImageUrl = result.filePath;
      } else {
        throw new Error('No file path returned from upload');
      }
      
      setPreviewUrl(newImageUrl);
      onImageUploaded(newImageUrl);
      
      // Automatically save the product with the new image URL
      try {
        const saveResponse = await fetch(`/api/admin/products/${productId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: newImageUrl
          })
        });

        if (saveResponse.ok) {
          toast({
            title: "Image Updated Successfully",
            description: "Product image has been saved and is now visible in the system"
          });
        } else {
          toast({
            title: "Image Uploaded",
            description: "Image uploaded but you need to save the product to make it visible",
            variant: "destructive"
          });
        }
      } catch (saveError) {
        console.error('Failed to save product:', saveError);
        toast({
          title: "Image Uploaded",
          description: "Image uploaded but you need to save the product to make it visible",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const removeImage = () => {
    setPreviewUrl(null);
    onImageUploaded('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Label htmlFor="product-image">Product Image</Label>
      
      {/* Image Preview */}
      {previewUrl && (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Product preview"
            className="w-32 h-32 object-cover rounded-lg border border-gray-200"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={removeImage}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-gray-300'}
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary'}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          id="product-image"
        />
        
        <div className="flex flex-col items-center space-y-2">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <ImageIcon className="h-8 w-8 text-gray-400" />
          )}
          
          <div className="text-sm text-gray-600">
            {uploading ? (
              'Uploading to Enterprise Image System...'
            ) : (
              <>
                <span className="font-medium text-primary">Click to upload</span> or drag and drop
                <br />
                PNG, JPEG, GIF, WebP up to 10MB
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alternative Upload Button */}
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center space-x-2"
        >
          <Upload className="h-4 w-4" />
          <span>Choose File</span>
        </Button>
        
        {uploading && (
          <span className="text-sm text-gray-500">
            Processing with enterprise image system...
          </span>
        )}
      </div>

      {/* Current URL Display (for reference) */}
      {previewUrl && (
        <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
          <strong>Image Path:</strong> {previewUrl}
        </div>
      )}
    </div>
  );
}