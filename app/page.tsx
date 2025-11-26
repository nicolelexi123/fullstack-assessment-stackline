"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Product {
  stacklineSku: string;
  title: string;
  categoryName: string;
  subCategoryName: string;
  imageUrls: string[];
}

const ALL_CATEGORIES = "__all_categories__";
const ALL_SUBCATEGORIES = "__all_subcategories__";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); 
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState<
    string | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      const params = new URLSearchParams();
      params.append("category", selectedCategory);

      fetch(`/api/subcategories?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => setSubCategories(data.subCategories));
    } else {
      setSubCategories([]);
      setSelectedSubCategory(undefined);
    }
  }, [selectedCategory]);

  // search only updates debouncedSearch every 2 seconds 
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 2000); 

    return () => clearTimeout(timer);
  }, [search]);


  useEffect(() => {
    setError(null);
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (selectedCategory) params.append("category", selectedCategory);
    if (selectedSubCategory) params.append("subCategory", selectedSubCategory);
    params.append("limit", "20");

    fetch(`/api/products?${params}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load products");
        }
        return res.json();
      })
      .then((data) => {
        setProducts(data.products);
      })
      .catch((err: unknown) => {
        console.error("Error loading products", err);
        setError("Failed to load products. Please try again.");
        setProducts([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [debouncedSearch, selectedCategory, selectedSubCategory]); 

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold mb-6">StackShop</h1>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={selectedCategory ?? ALL_CATEGORIES}
              onValueChange={(value) => {
                if (value === ALL_CATEGORIES) {
                  setSelectedCategory(undefined);
                } else {
                  setSelectedCategory(value);
                }
              }}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedCategory && subCategories.length > 0 && (
              <Select
                value={selectedSubCategory ?? ALL_SUBCATEGORIES}
                onValueChange={(value) => {
                  if (value === ALL_SUBCATEGORIES) {
                    setSelectedSubCategory(undefined);
                  } else {
                    setSelectedSubCategory(value);
                  }
                }}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="All Subcategories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SUBCATEGORIES}>
                    All Subcategories
                  </SelectItem>
                  {subCategories.map((subCat) => (
                    <SelectItem key={subCat} value={subCat}>
                      {subCat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(search || selectedCategory || selectedSubCategory) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory(undefined);
                  setSelectedSubCategory(undefined);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No products found</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {products.length} products
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <Link
                  key={product.stacklineSku}
                  href={{
                    pathname: "/product",
                    query: { sku: product.stacklineSku },
                  }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="p-0">
                      <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-muted">
                        {product.imageUrls[0] && (
                          <Image
                            src={product.imageUrls[0]}
                            alt={product.title}
                            fill
                            className="object-contain p-4"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <CardTitle className="text-base line-clamp-2 mb-2">
                        {product.title}
                      </CardTitle>
                      <CardDescription className="flex gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedCategory(product.categoryName);
                            setSelectedSubCategory(undefined);
                          }}
                        >
                          {product.categoryName}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedCategory(product.categoryName);
                            setSelectedSubCategory(product.subCategoryName);
                          }}
                        >
                          {product.subCategoryName}
                        </Badge>
                      </CardDescription>
                    </CardContent>
                    <CardFooter className="mt-auto">
                      <Button variant="outline" className="w-full">
                        View Details
                      </Button>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
