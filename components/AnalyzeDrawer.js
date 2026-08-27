import { useRef } from "react";
import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Progress,
  Spinner,
  Stack,
  Text,
  useColorMode,
} from "@chakra-ui/react";

export default function AnalyzeDrawer({
  isOpen,
  onClose,
  onFile,
  isAnalyzing,
  previewUrl,
  analysis,
  analysisError,
  tr,
}) {
  const inputRef = useRef(null);
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const topPrediction = analysis?.predictions?.[0];
  const detectedPets = analysis?.pets || [];
  const detectedPetCount = analysis?.detected_pet_count || 0;

  return (
    <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose} finalFocusRef={inputRef}>
      <DrawerOverlay bg="blackAlpha.500" />
      <DrawerContent bg={dark ? "#141118" : "#fbfafc"} color={dark ? "white" : "gray.800"}>
        <DrawerCloseButton top="4" right="4" />
        <DrawerHeader px={[5, 7]} pt="6" pb="4" borderBottom="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
          <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em" mb="2">
            PETLENS 2.0 · DETECT + VIT + CLIP
          </Text>
          <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.035em">
            {tr("사진 속 반려동물을 분석하세요", "Analyze the pets in your photo")}
          </Text>
          <Text color={dark ? "whiteAlpha.600" : "gray.500"} fontSize="sm" fontWeight="400" lineHeight="1.65" mt="2" pr="8">
            {tr(
              "사진에서 고양이와 강아지를 먼저 찾고, 감지된 개체마다 ViT Top-5와 CLIP 유사 이미지 검색을 실행합니다.",
              "PetLens detects cats and dogs first, then runs ViT top-5 classification and CLIP similarity retrieval for each detected pet."
            )}
          </Text>
        </DrawerHeader>

        <DrawerBody px={[5, 7]} pt="6" pb={[9, 10]}>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFile}
            style={{ display: "none" }}
          />

          {!previewUrl ? (
            <Box
              border="1px dashed"
              borderColor={dark ? "whiteAlpha.300" : "blackAlpha.300"}
              bg={dark ? "whiteAlpha.50" : "white"}
              borderRadius="16px"
              p={[7, 9]}
              mb="2"
              textAlign="center"
            >
              <Box
                as="img"
                src="/petlens-paw.png"
                alt=""
                w="64px"
                h="64px"
                mx="auto"
                mb="4"
                opacity="0.82"
                style={{ objectFit: "contain" }}
              />
              <Text fontWeight="700">{tr("반려동물이 포함된 사진", "Choose a photo with pets")}</Text>
              <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="xs" mt="2">JPG, PNG, WebP · 12MB max</Text>
              <Button mt="6" minH="48px" px="6" bg="pink.500" color="white" borderRadius="10px" _hover={{ bg: "pink.600" }} onClick={() => inputRef.current?.click()}>
                {tr("사진 선택", "Choose photo")}
              </Button>
            </Box>
          ) : (
            <Stack spacing="5">
              <Box position="relative" borderRadius="16px" overflow="hidden" bg={dark ? "whiteAlpha.100" : "gray.100"}>
                <Box
                  as="img"
                  src={previewUrl}
                  alt="Uploaded pet preview"
                  width="100%"
                  height="auto"
                  maxH="420px"
                  display="block"
                  style={{ objectFit: "contain" }}
                />
                {detectedPets.filter((pet) => !pet.fallback).map((pet, index) => (
                  <Box
                    key={pet.id}
                    position="absolute"
                    left={`${pet.box.normalized.x * 100}%`}
                    top={`${pet.box.normalized.y * 100}%`}
                    width={`${pet.box.normalized.width * 100}%`}
                    height={`${pet.box.normalized.height * 100}%`}
                    border="2px solid"
                    borderColor="pink.400"
                    borderRadius="10px"
                    pointerEvents="none"
                    boxShadow="0 0 0 1px rgba(255,255,255,0.55)"
                  >
                    <Text
                      position="absolute"
                      left="2"
                      top="2"
                      px="2"
                      py="1"
                      borderRadius="full"
                      bg="pink.500"
                      color="white"
                      fontSize="10px"
                      fontWeight="800"
                    >
                      {index + 1} · {pet.species.toUpperCase()}
                    </Text>
                  </Box>
                ))}
                {isAnalyzing && (
                  <Flex position="absolute" inset="0" bg={dark ? "rgba(20,17,24,0.78)" : "rgba(255,255,255,0.82)"} align="center" justify="center" direction="column">
                    <Spinner color="pink.400" thickness="3px" />
                    <Text fontSize="sm" mt="3" color={dark ? "whiteAlpha.800" : "gray.600"}>{tr("반려동물을 찾고 세 모델을 실행하고 있습니다…", "Detecting pets and running the analysis pipeline…")}</Text>
                  </Flex>
                )}
              </Box>

              {analysis && (
                <Box>
                  <Box
                    mb="6"
                    px="4"
                    py="3"
                    borderRadius="12px"
                    bg={dark ? "whiteAlpha.50" : "blackAlpha.50"}
                  >
                    <Text fontSize="xs" fontWeight="800" letterSpacing="0.08em" color="pink.500">
                      PETLENS 2.0 · DETECTION
                    </Text>
                    <Text mt="1.5" fontSize="sm" fontWeight="700">
                      {detectedPetCount > 0
                        ? tr(`${detectedPetCount}마리의 반려동물을 감지했습니다.`, `${detectedPetCount} pet${detectedPetCount > 1 ? "s" : ""} detected.`)
                        : tr("반려동물을 분리 감지하지 못해 전체 사진을 분석했습니다.", "No pet box was detected, so the full image was analyzed.")}
                    </Text>
                    <Text mt="1" fontSize="xs" lineHeight="1.6" color={dark ? "whiteAlpha.500" : "gray.500"}>
                      {detectedPetCount > 1
                        ? tr("각 개체를 따로 잘라 ViT 품종 예측과 CLIP 유사 이미지 검색을 실행했습니다.", "Each detected pet was cropped and analyzed independently with ViT and CLIP.")
                        : tr("감지된 반려동물 영역을 기준으로 품종과 유사 이미지를 분석합니다.", "Breed and similarity results are computed from the detected pet region.")}
                    </Text>
                  </Box>

                  {detectedPets.length > 1 && (
                    <Box mb="7">
                      <Text fontSize="sm" fontWeight="800">
                        {tr("개체별 분석", "Per-pet analysis")}
                      </Text>
                      <Stack spacing="3" mt="3">
                        {detectedPets.map((pet, petIndex) => {
                          const petTop = pet.predictions?.[0];
                          return (
                            <Box
                              key={pet.id}
                              border="1px solid"
                              borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"}
                              borderRadius="12px"
                              px="4"
                              py="3.5"
                              bg={dark ? "#19151d" : "white"}
                            >
                              <Flex align="center" justify="space-between">
                                <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.1em">
                                  PET {petIndex + 1} · {pet.species.toUpperCase()}
                                </Text>
                                {typeof pet.detector_score === "number" && (
                                  <Text ml="4" color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="10px">
                                    DETECT {(pet.detector_score * 100).toFixed(0)}%
                                  </Text>
                                )}
                              </Flex>
                              <Flex align="baseline" justify="space-between" mt="2">
                                <Text minW="0" fontSize="lg" fontWeight="800" textTransform="capitalize" noOfLines={1}>
                                  {petTop?.label}
                                </Text>
                                <Text ml="4" color="pink.500" fontWeight="800">
                                  {petTop ? `${(petTop.confidence * 100).toFixed(1)}%` : "-"}
                                </Text>
                              </Flex>
                              <Text mt="2" color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="xs" lineHeight="1.6">
                                {(pet.predictions || []).slice(1, 3).map((prediction) => `${prediction.label} ${(prediction.confidence * 100).toFixed(1)}%`).join(" · ")}
                              </Text>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}

                  <Flex align="end" justify="space-between" mb="5">
                    <Box minW="0">
                      <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="10px" fontWeight="800" letterSpacing="0.12em">
                        {detectedPets.length > 1
                          ? tr("대표 개체의 가장 높은 예측", "PRIMARY PET · TOP PREDICTION")
                          : tr("가장 높은 예측", "TOP PREDICTION")}
                      </Text>
                      <Text fontSize="2xl" fontWeight="800" mt="1" textTransform="capitalize" noOfLines={1}>{topPrediction?.label}</Text>
                    </Box>
                    <Text ml="4" color="pink.500" fontSize="2xl" fontWeight="800">{(topPrediction?.confidence * 100).toFixed(1)}%</Text>
                  </Flex>

                  <Stack spacing="3.5">
                    {analysis.predictions.map((prediction, index) => (
                      <Box key={`${prediction.label}-${index}`}>
                        <Flex align="baseline" mb="1.5">
                          <Text flex="1" minW="0" fontSize="sm" fontWeight={index === 0 ? "700" : "500"} textTransform="capitalize" noOfLines={1}>{prediction.label}</Text>
                          <Text ml="3" fontSize="xs" color={dark ? "whiteAlpha.500" : "gray.500"}>{(prediction.confidence * 100).toFixed(1)}%</Text>
                        </Flex>
                        <Progress value={prediction.confidence * 100} size="xs" colorScheme={index === 0 ? "pink" : "purple"} borderRadius="full" bg={dark ? "whiteAlpha.100" : "blackAlpha.100"} />
                      </Box>
                    ))}
                  </Stack>

                  <Box mt="6" pt="5" borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
                    <Text fontSize="sm" fontWeight="700">{tr("갤러리가 유사도 순으로 바뀌었습니다", "The gallery is now ranked by similarity")}</Text>
                    <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="xs" lineHeight="1.6" mt="1">
                      {detectedPets.length > 1
                        ? tr("현재는 감지 점수가 가장 높은 대표 개체를 기준으로 갤러리를 정렬합니다.", "The gallery is currently ranked from the highest-confidence detected pet.")
                        : tr("Drawer를 닫으면 CLIP 이미지 유사도 순위를 바로 확인할 수 있습니다.", "Close this drawer to inspect the CLIP image-similarity ranking.")}
                    </Text>
                  </Box>
                </Box>
              )}
            </Stack>
          )}

          {analysisError && <Text role="alert" mt="4" color="red.400" fontSize="sm">{analysisError}</Text>}
        </DrawerBody>

        <DrawerFooter px={[5, 7]} py="5" borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
          {previewUrl && (
            <Button mr="auto" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} isDisabled={isAnalyzing}>
              {tr("다른 사진 선택", "Choose another")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>{tr("닫기", "Close")}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
