import pets from "../data/pets.json";

const toGalleryPhoto = (pet) => ({
  id: pet.id,
  breed: pet.breed,
  species: pet.species,
  width: 400,
  height: 500,
  url: pet.image,
  photographer: "Oxford-IIIT Pet Dataset",
  photographer_url: pet.source_page,
  src: {
    original: pet.image,
    portrait: pet.image,
  },
});

export const PET_PHOTOS = pets.map(toGalleryPhoto);

export const getPetPhotoById = (id) =>
  PET_PHOTOS.find((photo) => String(photo.id) === String(id)) || null;

export const mapRankedIdsToPhotos = (ranked = []) =>
  ranked
    .map(({ id, score }) => {
      const photo = getPetPhotoById(id);
      return photo ? { ...photo, score } : null;
    })
    .filter(Boolean);
