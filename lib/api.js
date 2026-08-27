import { PET_PHOTOS, getPetPhotoById, mapRankedIdsToPhotos } from "./catalog";

const API_URL = process.env.NEXT_PUBLIC_PETLENS_API_URL || "http://127.0.0.1:8000";

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `PetLens API error (${response.status})`);
  }
  return response.json();
};

export const getCuratedPhotos = async () => PET_PHOTOS;

export const getQueryPhotos = async (query) => {
  try {
    const payload = await requestJson("/search/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: 16 }),
    });
    return mapRankedIdsToPhotos(payload.results);
  } catch (error) {
    const normalized = query.trim().toLowerCase();
    const lexical = PET_PHOTOS.filter((photo) =>
      `${photo.breed} ${photo.species}`.toLowerCase().includes(normalized)
    );
    if (lexical.length > 0) return lexical;
    throw error;
  }
};

export const getPhotoById = async (id) => getPetPhotoById(id);

export const classifyPet = async (file) => {
  const body = new FormData();
  body.append("file", file);
  return requestJson("/classify", { method: "POST", body });
};

export const analyzePet = async (file, topK = 16) => {
  const body = new FormData();
  body.append("file", file);
  const payload = await requestJson(`/analyze?top_k=${topK}`, {
    method: "POST",
    body,
  });
  return {
    ...payload,
    matches: mapRankedIdsToPhotos(payload.results || []),
    pets: (payload.pets || []).map((pet) => ({
      ...pet,
      matches: mapRankedIdsToPhotos(pet.results || []),
    })),
  };
};

export const getImageMatches = async (file, topK = 12) => {
  const body = new FormData();
  body.append("file", file);
  const payload = await requestJson(`/search/image?top_k=${topK}`, {
    method: "POST",
    body,
  });
  return mapRankedIdsToPhotos(payload.results);
};

export const compareRetrievalModels = async (file, topK = 8) => {
  const body = new FormData();
  body.append("file", file);
  const payload = await requestJson(`/compare/retrieval?top_k=${topK}`, {
    method: "POST",
    body,
  });
  return {
    ...payload,
    clip: {
      ...payload.clip,
      matches: mapRankedIdsToPhotos(payload.clip?.results || []),
    },
    dino: {
      ...payload.dino,
      matches: mapRankedIdsToPhotos(payload.dino?.results || []),
    },
  };
};

export const compareSiglip2OpenSet = async (file, topK = 5) => {
  const body = new FormData();
  body.append("file", file);
  return requestJson(`/open-set/siglip2?top_k=${topK}`, {
    method: "POST",
    body,
  });
};

export const getRuntimeHealth = async () => requestJson("/health");
