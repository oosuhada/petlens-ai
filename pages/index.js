import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Stack,
  Spinner,
  Text,
  useColorMode,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { ArrowForwardIcon, SearchIcon } from "@chakra-ui/icons";

import AnalyzeDrawer from "../components/AnalyzeDrawer";
import ExplorerHeader from "../components/ExplorerHeader";
import PhotoStage from "../components/PhotoStage";
import PhotoTile from "../components/PhotoTile";
import VideoAnalyzeDrawer from "../components/VideoAnalyzeDrawer";
import usePetLensLocale from "../hooks/usePetLensLocale";
import useReducedMotionPreference from "../hooks/useReducedMotionPreference";
import {
  analyzePet,
  analyzePetPose,
  analyzePetVideo,
  compareRetrievalModels,
  compareSiglip2OpenSet,
  getCuratedPhotos,
  getQueryPhotos,
} from "../lib/api";

export default function Home({ data }) {
  const { isKo, tr, changeLanguage } = usePetLensLocale();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const reducedMotion = useReducedMotionPreference();
  const drawer = useDisclosure();
  const videoDrawer = useDisclosure();
  const toast = useToast();

  const [photos, setPhotos] = useState(data);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysisFile, setAnalysisFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [siglipComparison, setSiglipComparison] = useState(null);
  const [retrievalComparison, setRetrievalComparison] = useState(null);
  const [advancedError, setAdvancedError] = useState("");
  const [isSiglipComparing, setIsSiglipComparing] = useState(false);
  const [isRetrievalComparing, setIsRetrievalComparing] = useState(false);
  const [poseAnalysis, setPoseAnalysis] = useState(null);
  const [poseError, setPoseError] = useState("");
  const [isPoseAnalyzing, setIsPoseAnalyzing] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoAnalysis, setVideoAnalysis] = useState(null);
  const [videoError, setVideoError] = useState("");
  const [isVideoAnalyzing, setIsVideoAnalyzing] = useState(false);

  const featured = useMemo(
    () => ["samoyed", "newfoundland", "ragdoll"].map((id) => data.find((photo) => photo.id === id)).filter(Boolean),
    [data]
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
  }, [videoPreviewUrl]);

  const resetGallery = () => {
    setPhotos(data);
    setQuery("");
    setActiveQuery("");
    setMode("all");
    setSpeciesFilter("all");
    setSearchError("");
    setSelectedPetId("");
    setSiglipComparison(null);
    setRetrievalComparison(null);
    setAdvancedError("");
    setPoseAnalysis(null);
    setPoseError("");
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) {
      toast({
        title: tr("검색어를 입력해주세요.", "Enter a search description."),
        description: tr("영어 자연어 검색이 가장 안정적입니다.", "English natural-language queries work best."),
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    setIsSearching(true);
    setSearchError("");
    try {
      const result = await getQueryPhotos(nextQuery);
      setPhotos(result);
      setActiveQuery(nextQuery);
      setMode("search");
    } catch (error) {
      setSearchError(error.message || tr("검색을 사용할 수 없습니다.", "Semantic search is unavailable."));
    } finally {
      setIsSearching(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAnalysisError(tr("이미지 파일을 선택해주세요.", "Please choose an image file."));
      event.target.value = "";
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setAnalysisError(tr("12MB 이하 이미지를 선택해주세요.", "Please choose an image under 12 MB."));
      event.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisFile(file);
    setAnalysis(null);
    setSelectedPetId("");
    setSiglipComparison(null);
    setRetrievalComparison(null);
    setAdvancedError("");
    setPoseAnalysis(null);
    setPoseError("");
    setAnalysisError("");
    setIsAnalyzing(true);
    drawer.onOpen();

    try {
      const result = await analyzePet(file, 16);
      const primaryPet = result.pets?.find((pet) => pet.id === result.primary_pet_id) || result.pets?.[0];
      setAnalysis(result);
      setSelectedPetId(primaryPet?.id || "");
      setPhotos(primaryPet?.matches || result.matches);
      setMode("similar");
      setActiveQuery("");
      setQuery("");
    } catch (error) {
      setAnalysisError(error.message || tr("이미지 분석을 사용할 수 없습니다.", "Image analysis is unavailable."));
    } finally {
      setIsAnalyzing(false);
      event.target.value = "";
    }
  };

  const selectedPet = useMemo(() => {
    if (!analysis?.pets?.length) return null;
    return analysis.pets.find((pet) => pet.id === selectedPetId) || analysis.pets[0];
  }, [analysis, selectedPetId]);

  const handleSelectPet = (petId) => {
    const pet = analysis?.pets?.find((item) => item.id === petId);
    if (!pet) return;
    setSelectedPetId(pet.id);
    setPhotos(pet.matches || []);
    setMode("similar");
    setSpeciesFilter("all");
    setActiveQuery("");
    setQuery("");
  };

  const handleSiglipCompare = async () => {
    if (!analysisFile || isSiglipComparing) return;
    setIsSiglipComparing(true);
    setAdvancedError("");
    try {
      const result = await compareSiglip2OpenSet(analysisFile, 5);
      setSiglipComparison(result);
    } catch (error) {
      setAdvancedError(error.message || tr("SigLIP2 비교를 실행할 수 없습니다.", "SigLIP2 comparison is unavailable."));
    } finally {
      setIsSiglipComparing(false);
    }
  };

  const handleRetrievalCompare = async () => {
    if (!analysisFile || isRetrievalComparing) return;
    setIsRetrievalComparing(true);
    setAdvancedError("");
    try {
      const result = await compareRetrievalModels(analysisFile, 6);
      setRetrievalComparison(result);
    } catch (error) {
      setAdvancedError(error.message || tr("검색 모델 비교를 실행할 수 없습니다.", "Retrieval comparison is unavailable."));
    } finally {
      setIsRetrievalComparing(false);
    }
  };

  const handlePoseAnalyze = async () => {
    if (!analysisFile || isPoseAnalyzing) return;
    setIsPoseAnalyzing(true);
    setPoseError("");
    try {
      const result = await analyzePetPose(analysisFile, 4);
      setPoseAnalysis(result);
    } catch (error) {
      setPoseError(error.message || tr("동물 포즈 추정을 실행할 수 없습니다.", "Animal pose estimation is unavailable."));
    } finally {
      setIsPoseAnalyzing(false);
    }
  };

  const handleVideoFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedExtension = /\.(mp4|m4v|mov|webm)$/i.test(file.name || "");
    if (!file.type.startsWith("video/") && !allowedExtension) {
      setVideoError(tr("영상 파일을 선택해주세요.", "Please choose a video file."));
      event.target.value = "";
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setVideoError(tr("80MB 이하 영상을 선택해주세요.", "Please choose a video under 80 MB."));
      event.target.value = "";
      return;
    }

    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setVideoAnalysis(null);
    setVideoError("");
    setIsVideoAnalyzing(true);
    videoDrawer.onOpen();
    try {
      const result = await analyzePetVideo(file, 8);
      setVideoAnalysis(result);
    } catch (error) {
      setVideoError(error.message || tr("영상 분석을 사용할 수 없습니다.", "Video analysis is unavailable."));
    } finally {
      setIsVideoAnalyzing(false);
      event.target.value = "";
    }
  };

  const galleryMeta = {
    all: {
      eyebrow: tr("전체 라이브러리", "LIBRARY"),
      title: tr("37개 품종", "37 breeds"),
      subtitle: "",
    },
    search: {
      eyebrow: "CLIP · TEXT → IMAGE",
      title: tr("의미 검색 결과", "Semantic search"),
      subtitle: activeQuery ? `“${activeQuery}”` : "",
    },
    similar: {
      eyebrow: "CLIP · IMAGE → IMAGE",
      title: tr("업로드 사진과 닮은 순서", "Similar to your upload"),
      subtitle: selectedPet?.predictions?.[0]
        ? tr(
            `${selectedPetId ? `${selectedPet.id.toUpperCase()} · ` : ""}ViT 1순위 · ${selectedPet.predictions[0].label}`,
            `${selectedPetId ? `${selectedPet.id.toUpperCase()} · ` : ""}ViT top-1 · ${selectedPet.predictions[0].label}`
          )
        : tr("이미지 임베딩 유사도 순위", "Ranked by image-embedding similarity"),
    },
  }[mode];

  const visiblePhotos = photos.filter((photo) =>
    speciesFilter === "all" ? true : photo.species === speciesFilter
  );

  return (
    <Box minH="100vh" bg={dark ? "#0f0c12" : "#fbfafc"} color={dark ? "white" : "gray.800"} overflowX="hidden">
      <Head>
        <title>PetLens — Visual Pet Explorer</title>
        <meta name="description" content="Explore Oxford-IIIT Pet with ViT breed analysis and CLIP semantic retrieval." />
      </Head>

      <ExplorerHeader
        isKo={isKo}
        changeLanguage={changeLanguage}
        tr={tr}
      />

      <PhotoStage featured={featured} tr={tr} />

      <Box as="main" maxW="1540px" mx="auto" px={[2, 3, 5]} pt={[4, 5, 6]} pb={[20, 18]}>
        <Box id="explore-tools" px={[1, 1, 2]} mb={[7, 8, 10]}>
          <Flex
            direction="column"
            align="stretch"
          >
            <Box
              flex="1"
              mb={[2, 3, 3]}
              bg={dark ? "#17131d" : "white"}
              border="1px solid"
              borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"}
              borderRadius={["16px", "18px"]}
              p={[5, 6, 7]}
              boxShadow={dark ? "0 18px 38px rgba(0,0,0,0.20)" : "0 18px 42px rgba(59,37,70,0.07)"}
            >
              <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em">
                CLIP · {tr("의미 기반 검색", "SEMANTIC SEARCH")}
              </Text>
              <Heading
                as="h2"
                mt="3"
                fontSize={["2xl", "3xl"]}
                lineHeight="1.16"
                letterSpacing="-0.04em"
              >
                {isKo ? (
                  <>
                    <Box as="span" display="block" whiteSpace="nowrap">문장으로 찾고,</Box>
                    <Box as="span" display="block" whiteSpace="nowrap">사진으로 이어가세요.</Box>
                  </>
                ) : (
                  <>
                    <Box as="span" display="block">Search by sentence.</Box>
                    <Box as="span" display="block">Continue with images.</Box>
                  </>
                )}
              </Heading>
              <Text
                color={dark ? "whiteAlpha.700" : "gray.600"}
                mt="4"
                fontSize="sm"
                lineHeight="1.75"
                maxW="640px"
                wordBreak="keep-all"
              >
                {tr(
                  "원하는 장면을 문장으로 설명하면 CLIP이 37개 레퍼런스를 의미적으로 다시 정렬합니다. 현재는 영어 자연어 검색에서 가장 안정적으로 동작합니다.",
                  "Describe the scene you want and CLIP re-ranks all 37 references by semantic similarity. English queries are the most stable in this demo."
                )}
              </Text>
              <form onSubmit={handleSearch}>
                <Stack direction={["column", "row"]} spacing="3" mt="5">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    h="50px"
                    borderRadius="10px"
                    bg={dark ? "whiteAlpha.100" : "#fbfafc"}
                    borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"}
                    placeholder={tr("예: a small white fluffy dog", "Try: a small white fluffy dog")}
                    _placeholder={{ color: dark ? "whiteAlpha.400" : "gray.400" }}
                    _focus={{ borderColor: "pink.400", boxShadow: "0 0 0 1px #ed64a6" }}
                  />
                  <Button
                    type="submit"
                    leftIcon={<SearchIcon />}
                    h="50px"
                    px="6"
                    borderRadius="10px"
                    bg="pink.500"
                    color="white"
                    isLoading={isSearching}
                    loadingText={tr("검색 중", "Searching")}
                    flexShrink="0"
                    _hover={{ bg: "pink.600" }}
                  >
                    {tr("검색", "Search")}
                  </Button>
                </Stack>
              </form>
              {searchError && (
                <Text mt="3" fontSize="sm" color={dark ? "red.200" : "red.600"}>
                  {searchError}
                </Text>
              )}
            </Box>

            <Box
              flex="1"
              bg={dark ? "#17131d" : "white"}
              border="1px solid"
              borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"}
              borderRadius={["16px", "18px"]}
              p={[5, 6, 7]}
              boxShadow={dark ? "0 18px 38px rgba(0,0,0,0.20)" : "0 18px 42px rgba(59,37,70,0.07)"}
            >
              <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em">
                PETLENS 2.0 · {tr("감지 + 품종 분석", "DETECT + BREED ANALYSIS")}
              </Text>
              <Heading
                as="h2"
                mt="3"
                fontSize={["2xl", "3xl"]}
                lineHeight="1.16"
                letterSpacing="-0.04em"
              >
                {tr("반려동물 사진 분석", "Analyze a pet photo")}
              </Heading>
              <Text
                color={dark ? "whiteAlpha.700" : "gray.600"}
                mt="4"
                fontSize="sm"
                lineHeight="1.75"
                maxW="640px"
                wordBreak="keep-all"
              >
                {tr(
                  "한 장의 사진에서 고양이와 강아지를 먼저 찾아 개체별로 분석합니다. 여러 마리나 사람·사물이 함께 있는 사진도 감지된 반려동물 영역을 기준으로 ViT Top-5와 CLIP 유사도 검색을 실행합니다.",
                  "PetLens first detects cats and dogs, then analyzes each pet independently. Multi-pet photos and busy scenes are processed from the detected pet regions with ViT top-5 classification and CLIP similarity search."
                )}
              </Text>
              <Flex
                mt="5"
                align="center"
                direction="row"
                wrap="wrap"
              >
                <Button
                  h="50px"
                  px="6"
                  mr={[4, 8, 12]}
                  borderRadius="10px"
                  bg={dark ? "white" : "#241c2c"}
                  color={dark ? "#241c2c" : "white"}
                  onClick={drawer.onOpen}
                  _hover={{ opacity: 0.9 }}
                >
                  {analysis ? tr("분석 결과 보기", "View analysis") : tr("사진 선택", "Choose a photo")}
                </Button>
                <Button
                  h="50px"
                  px="6"
                  mr={[4, 8, 12]}
                  mb={[3, 0]}
                  borderRadius="10px"
                  variant="outline"
                  borderColor={dark ? "whiteAlpha.300" : "blackAlpha.200"}
                  onClick={videoDrawer.onOpen}
                >
                  {videoAnalysis ? tr("영상 결과 보기", "View video result") : tr("영상 분석", "Analyze video")}
                </Button>
                <Text
                  color={dark ? "whiteAlpha.400" : "gray.400"}
                  fontSize="xs"
                  lineHeight="1.5"
                >
                  {tr("사진 12MB · 영상 80MB 이하", "Photo 12 MB · video 80 MB max")}
                </Text>
              </Flex>
            </Box>
          </Flex>
        </Box>

        <Flex
          align={["flex-start", "center"]}
          justify="space-between"
          direction={["column", "row"]}
          px={[1, 1, 2]}
          mb={[4, 5]}
        >
          <Box minW="0">
            <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.15em">
              {galleryMeta.eyebrow}
            </Text>
            <Flex align="baseline" mt="1.5" wrap="wrap">
              <Text mr="3" fontSize={["xl", "2xl"]} fontWeight="800" letterSpacing="-0.035em">
                {galleryMeta.title}
              </Text>
              {galleryMeta.subtitle && (
                <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="sm" maxW="680px" noOfLines={1}>
                  {galleryMeta.subtitle}
                </Text>
              )}
            </Flex>
          </Box>

          <Flex align="center" flexShrink="0" wrap="wrap" justify="flex-end" mt={[3, 0]}>
            {mode === "all" ? (
              <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="sm" textAlign="right">
                {tr("Oxford-IIIT Pet의 전체 레퍼런스", "Complete Oxford-IIIT Pet reference set")}
              </Text>
            ) : (
              <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="xs">
                {tr(`${visiblePhotos.length}개 결과`, `${visiblePhotos.length} results`)}
              </Text>
            )}
            {mode !== "all" && (
              <Button ml="2" size="xs" variant="ghost" borderRadius="8px" color="pink.500" onClick={resetGallery}>
                {tr("전체 보기", "All breeds")}
              </Button>
            )}
          </Flex>
        </Flex>

        <Flex px={[1, 1, 2]} mb={[4, 5]} wrap="wrap">
          {[
            ["all", tr("전체", "All")],
            ["dog", tr("강아지", "Dogs")],
            ["cat", tr("고양이", "Cats")],
          ].map(([value, label]) => {
            const active = speciesFilter === value;
            return (
              <Button
                key={value}
                size="sm"
                borderRadius="full"
                px="4"
                mr="2"
                mb="2"
                variant={active ? "solid" : "outline"}
                bg={active ? (dark ? "white" : "#241c2c") : "transparent"}
                color={active ? (dark ? "#241c2c" : "white") : (dark ? "whiteAlpha.700" : "gray.600")}
                borderColor={dark ? "whiteAlpha.200" : "blackAlpha.200"}
                _hover={{ bg: active ? undefined : (dark ? "whiteAlpha.100" : "blackAlpha.50") }}
                onClick={() => setSpeciesFilter(value)}
              >
                {label}
              </Button>
            );
          })}
        </Flex>

        {searchError && (
          <Box mx={[1, 1, 2]} mb="4" px="4" py="3" borderRadius="10px" bg={dark ? "red.900" : "red.50"} color={dark ? "red.100" : "red.700"} fontSize="sm">
            {searchError}
          </Box>
        )}

        {isSearching ? (
          <Flex minH="420px" align="center" justify="center" direction="column">
            <Spinner color="pink.500" thickness="3px" />
            <Text mt="3" fontSize="sm" color={dark ? "whiteAlpha.500" : "gray.500"}>
              {tr("CLIP 임베딩으로 사진 순위를 계산하고 있습니다…", "Ranking photos in CLIP embedding space…")}
            </Text>
          </Flex>
        ) : (
          <Box
            sx={{
              columnCount: [2, 3, 4, 5, 6],
              columnGap: ["8px", "10px", "12px"],
            }}
          >
            {visiblePhotos.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                index={index}
                ranked={mode !== "all"}
                reducedMotion={reducedMotion}
              />
            ))}
          </Box>
        )}

        <Flex
          mt={[8, 10]}
          pt="5"
          borderTop="1px solid"
          borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
          justify="space-between"
          align={["flex-start", "center"]}
          direction={["column", "row"]}
          px={[1, 1, 2]}
        >
          <Text color={dark ? "whiteAlpha.400" : "gray.500"} fontSize="xs">
            {tr("Oxford-IIIT Pet · ViT 분류 · CLIP 검색", "Oxford-IIIT Pet · ViT classification · CLIP retrieval")}
          </Text>
          <Flex mt={[3, 0]} fontSize="xs">
            <Link href="/onboarding" passHref><Text as="a" color={dark ? "whiteAlpha.600" : "gray.500"}>{tr("시작하기", "Onboarding")}</Text></Link>
            <Link href="/guide" passHref><Text as="a" ml="4" color={dark ? "whiteAlpha.600" : "gray.500"}>{tr("결과 읽는 법", "Guide")}</Text></Link>
          </Flex>
        </Flex>
      </Box>

      <Button
        display={["inline-flex", "none"]}
        position="fixed"
        right="4"
        bottom="calc(16px + env(safe-area-inset-bottom))"
        zIndex="30"
        h="48px"
        px="4"
        borderRadius="full"
        bg="pink.500"
        color="white"
        boxShadow="0 12px 30px rgba(190,24,93,0.28)"
        _hover={{ bg: "pink.600" }}
        onClick={drawer.onOpen}
      >
        {tr("사진 분석", "Analyze")}
        <ArrowForwardIcon ml="2" />
      </Button>

      <AnalyzeDrawer
        isOpen={drawer.isOpen}
        onClose={drawer.onClose}
        onFile={handleFile}
        onSelectPet={handleSelectPet}
        selectedPetId={selectedPetId}
        isAnalyzing={isAnalyzing}
        previewUrl={previewUrl}
        analysis={analysis}
        analysisError={analysisError}
        siglipComparison={siglipComparison}
        retrievalComparison={retrievalComparison}
        advancedError={advancedError}
        isSiglipComparing={isSiglipComparing}
        isRetrievalComparing={isRetrievalComparing}
        poseAnalysis={poseAnalysis}
        poseError={poseError}
        isPoseAnalyzing={isPoseAnalyzing}
        onSiglipCompare={handleSiglipCompare}
        onRetrievalCompare={handleRetrievalCompare}
        onPoseAnalyze={handlePoseAnalyze}
        tr={tr}
      />

      <VideoAnalyzeDrawer
        isOpen={videoDrawer.isOpen}
        onClose={videoDrawer.onClose}
        onFile={handleVideoFile}
        isAnalyzing={isVideoAnalyzing}
        previewUrl={videoPreviewUrl}
        analysis={videoAnalysis}
        analysisError={videoError}
        tr={tr}
      />
    </Box>
  );
}

export async function getServerSideProps() {
  const data = await getCuratedPhotos();
  return { props: { data } };
}
