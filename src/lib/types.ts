export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
};

export type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string;
  bannerUrl?: string;
  rating: number;
  productCount: number;
  verified: boolean;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  productCount: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  rating: number;
  reviewsCount: number;
  stock: number;
  badge?: string;
  images: string[];
  category: Category;
  shop: Shop;
  variants: ProductVariant[];
};

export type CartLine = {
  lineId: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
};

export type StorefrontData = {
  products: Product[];
  categories: Category[];
  shops: Shop[];
  isLive: boolean;
};
