import axios from 'axios';

const BASE_URL = 'https://gemmatex.store/api/v1';
const PAGE_SIZE = 8;

// Categorías y subcategorías: se cachean indefinidamente (datos estables)
let cachedCategories = null;
let cachedSubcategories = null;

// Productos: caché con TTL de 5 minutos — key: `${subcategoryId}_${page}`
const PRODUCTS_TTL_MS = 5 * 60 * 1000;
const productsCache = new Map();

// Detalle de producto: caché con TTL de 5 minutos — key: productId
const productDetailCache = new Map();

async function getCategories() {
  if (cachedCategories) return cachedCategories;
  const res = await axios.get(`${BASE_URL}/categories`);
  cachedCategories = res.data;
  return cachedCategories;
}

async function getSubcategories() {
  if (cachedSubcategories) return cachedSubcategories;
  const res = await axios.get(`${BASE_URL}/subcategories`);
  cachedSubcategories = res.data;
  return cachedSubcategories;
}

async function getSubcategoriesByCategory(categoryId) {
  const all = await getSubcategories();
  return all.filter(s => s.categoryId === categoryId);
}

async function getProductsBySubcategory(subcategoryId, page = 1) {
  const key = `${subcategoryId}_${page}`;
  const cached = productsCache.get(key);
  if (cached && Date.now() - cached.ts < PRODUCTS_TTL_MS) {
    return cached.data;
  }
  const res = await axios.get(`${BASE_URL}/products`, {
    params: { subcategoryId, page, pageSize: PAGE_SIZE },
  });
  productsCache.set(key, { data: res.data, ts: Date.now() });
  return res.data;
}

async function getProduct(productId) {
  const cached = productDetailCache.get(productId);
  if (cached && Date.now() - cached.ts < PRODUCTS_TTL_MS) {
    return cached.data;
  }
  const res = await axios.get(`${BASE_URL}/products/${productId}`);
  productDetailCache.set(productId, { data: res.data, ts: Date.now() });
  return res.data;
}

export default {
  getCategories,
  getSubcategories,
  getSubcategoriesByCategory,
  getProductsBySubcategory,
  getProduct,
  PAGE_SIZE,
};
