'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/products'; 

export default function ProductPage() {
  const searchParams = useSearchParams();
  const sku = searchParams.get('sku');
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sku) {
      setError('Product not found');
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/products/${encodeURIComponent(sku)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Product not found');
          throw new Error('Failed to load product');
        }
        return res.json();
      })
      .then((data: Product) => {
        setProduct(data);
      })
      .catch((err: unknown) => {
        console.error('Error loading product', err);
        const message =
          err instanceof Error ? err.message : 'Failed to load product';
        setError(message);
        setProduct(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sku]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card className="p-8">
            <p className="text-center text-muted-foreground">Loading product...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </Link>
          <Card className="p-8">
            <p className="text-center text-muted-foreground">
              {error || 'Product not found'}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative h-96 w-full bg-muted">
                  {product.imageUrls[selectedImage] && (
                    <Image
                      src={product.imageUrls[selectedImage]}
                      alt={product.title}
                      fill
                      className="object-contain p-8"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {product.imageUrls.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.imageUrls.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`relative h-20 border-2 rounded-lg overflow-hidden ${
                      selectedImage === idx ? 'border-primary' : 'border-muted'
                    }`}
                  >
                    <Image
                      src={url}
                      alt={`${product.title} - Image ${idx + 1}`}
                      fill
                      className="object-contain p-2"
                      sizes="100px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex gap-2 mb-2">
                <Badge variant="secondary">{product.categoryName}</Badge>
                <Badge variant="outline">{product.subCategoryName}</Badge>
              </div>
              <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
              <p className="text-sm text-muted-foreground">
                SKU: {product.retailerSku}
              </p>
            </div>

            {Array.isArray(product.featureBullets) &&
              product.featureBullets.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h2 className="text-lg font-semibold mb-3">Features</h2>
                    <ul className="space-y-2">
                      {product.featureBullets.map((feature, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="mr-2 mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
