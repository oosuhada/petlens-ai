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
  onSelectPet,
  selectedPetId,
  isAnalyzing,
  previewUrl,
  analysis,
  analysisError,
  siglipComparison,
  retrievalComparison,
  advancedError,
  isSiglipComparing,
  isRetrievalComparing,
  poseAnalysis,
  poseError,
  isPoseAnalyzing,
  onSiglipCompare,
  onRetrievalCompare,
  onPoseAnalyze,
  tr,
}) {
  const inputRef = useRef(null);
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const detectedPets = analysis?.pets || [];
  const detectedPetCount = analysis?.detected_pet_count || 0;
  const selectedPet = detectedPets.find((pet) => pet.id === selectedPetId) || detectedPets[0] || null;
  const selectedPredictions = selectedPet?.predictions || analysis?.predictions || [];
  const topPrediction = selectedPredictions[0];
  const selectedSegmentation = selectedPet?.segmentation || null;
  const selectedOpenSet = selectedPet?.open_set || analysis?.open_set || null;
  const selectedPose = (poseAnalysis?.poses || []).find((pose) => pose.pet_id === selectedPet?.id) || poseAnalysis?.poses?.[0] || null;
  const poseImage = poseAnalysis?.image || analysis?.image || null;

  return (
    <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose} finalFocusRef={inputRef}>
      <DrawerOverlay bg="blackAlpha.500" />
      <DrawerContent bg={dark ? "#141118" : "#fbfafc"} color={dark ? "white" : "gray.800"}>
        <DrawerCloseButton top="4" right="4" />
        <DrawerHeader px={[5, 7]} pt="6" pb="4" borderBottom="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
          <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em" mb="2">
            PETLENS 2.0 · DETECT + SAM2 + VIT + CLIP
          </Text>
          <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.035em">
            {tr("사진 속 반려동물을 분석하세요", "Analyze the pets in your photo")}
          </Text>
          <Text color={dark ? "whiteAlpha.600" : "gray.500"} fontSize="sm" fontWeight="400" lineHeight="1.65" mt="2" pr="8">
            {tr(
              "사진에서 고양이와 강아지를 찾고 SAM2로 배경을 분리한 뒤, 개체마다 ViT Top-5와 CLIP 유사 이미지 검색을 실행합니다.",
              "PetLens detects cats and dogs, isolates each pet with SAM2, then runs ViT top-5 classification and CLIP similarity retrieval."
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
                    as="button"
                    type="button"
                    key={pet.id}
                    position="absolute"
                    left={`${pet.box.normalized.x * 100}%`}
                    top={`${pet.box.normalized.y * 100}%`}
                    width={`${pet.box.normalized.width * 100}%`}
                    height={`${pet.box.normalized.height * 100}%`}
                    border="2px solid"
                    borderColor={selectedPet?.id === pet.id ? "pink.400" : "whiteAlpha.700"}
                    borderRadius="10px"
                    cursor="pointer"
                    onClick={() => onSelectPet?.(pet.id)}
                    boxShadow={selectedPet?.id === pet.id ? "0 0 0 2px rgba(236,72,153,0.28)" : "0 0 0 1px rgba(255,255,255,0.55)"}
                    _focus={{ outline: "none", boxShadow: "0 0 0 3px rgba(236,72,153,0.42)" }}
                    aria-label={tr(`반려동물 ${index + 1} 선택`, `Select pet ${index + 1}`)}
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
                {selectedPose && poseImage && (selectedPose.keypoints || []).map((keypoint, index) => (
                  <Box
                    key={`${selectedPose.pet_id}-${keypoint.label}-${index}`}
                    position="absolute"
                    left={`${(keypoint.x / poseImage.width) * 100}%`}
                    top={`${(keypoint.y / poseImage.height) * 100}%`}
                    transform="translate(-50%, -50%)"
                    w="9px"
                    h="9px"
                    borderRadius="full"
                    bg="cyan.300"
                    border="2px solid white"
                    boxShadow="0 1px 6px rgba(0,0,0,.45)"
                    pointerEvents="none"
                    title={`${keypoint.label} ${(keypoint.score * 100).toFixed(0)}%`}
                  />
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
                    {analysis?.segmentation?.status === "segmented" && (
                      <Text mt="2" fontSize="xs" lineHeight="1.6" color={dark ? "whiteAlpha.600" : "gray.600"}>
                        {tr(
                          "SAM2 마스크로 배경을 줄인 개체 이미지를 분류와 유사도 검색에 사용했습니다.",
                          "SAM2 masks were used to reduce background before classification and retrieval."
                        )}
                      </Text>
                    )}
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
                              as="button"
                              type="button"
                              key={pet.id}
                              border="1px solid"
                              borderColor={selectedPet?.id === pet.id ? "pink.400" : (dark ? "whiteAlpha.200" : "blackAlpha.100")}
                              borderRadius="12px"
                              px="4"
                              py="3.5"
                              width="100%"
                              textAlign="left"
                              bg={dark ? "#19151d" : "white"}
                              cursor="pointer"
                              onClick={() => onSelectPet?.(pet.id)}
                              boxShadow={selectedPet?.id === pet.id ? "0 0 0 1px rgba(236,72,153,0.22)" : "none"}
                              _hover={{ borderColor: "pink.300" }}
                              _focus={{ outline: "none", boxShadow: "0 0 0 3px rgba(236,72,153,0.28)" }}
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
                              {pet.open_set?.is_uncertain && (
                                <Text mt="2" color={dark ? "orange.200" : "orange.600"} fontSize="xs" fontWeight="700">
                                  {tr("지원 품종 밖일 가능성 · 결과를 후보로만 확인하세요", "Possibly outside the supported breed set · treat this as a candidate")}
                                </Text>
                              )}
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
                          ? tr("선택한 개체의 가장 높은 예측", "SELECTED PET · TOP PREDICTION")
                          : tr("가장 높은 예측", "TOP PREDICTION")}
                      </Text>
                      <Text fontSize="2xl" fontWeight="800" mt="1" textTransform="capitalize" noOfLines={1}>{topPrediction?.label}</Text>
                    </Box>
                    <Text ml="4" color="pink.500" fontSize="2xl" fontWeight="800">{(topPrediction?.confidence * 100).toFixed(1)}%</Text>
                  </Flex>

                  {selectedSegmentation?.status === "segmented" && (
                    <Box mb="5" px="4" py="3" borderRadius="10px" bg={dark ? "whiteAlpha.50" : "blackAlpha.50"}>
                      <Text fontSize="xs" fontWeight="800" color="purple.400">
                        SAM2 · SEGMENTED SUBJECT
                      </Text>
                      <Text mt="1" fontSize="xs" color={dark ? "whiteAlpha.600" : "gray.600"}>
                        {tr(
                          `마스크 품질 점수 ${(selectedSegmentation.iou_score * 100).toFixed(1)}% · 선택 crop의 ${(selectedSegmentation.mask_area_ratio * 100).toFixed(0)}%가 반려동물 영역입니다.`,
                          `Mask quality ${(selectedSegmentation.iou_score * 100).toFixed(1)}% · ${(selectedSegmentation.mask_area_ratio * 100).toFixed(0)}% of the selected crop is pet foreground.`
                        )}
                      </Text>
                    </Box>
                  )}

                  {selectedOpenSet?.is_uncertain && (
                    <Box mb="5" px="4" py="3" borderRadius="10px" border="1px solid" borderColor={dark ? "orange.300" : "orange.200"} bg={dark ? "rgba(192,86,33,0.12)" : "orange.50"}>
                      <Text fontSize="xs" fontWeight="800" color={dark ? "orange.200" : "orange.700"}>
                        {tr("37개 지원 품종 밖일 가능성", "POSSIBLY OUTSIDE THE 37 SUPPORTED BREEDS")}
                      </Text>
                      <Text mt="1" fontSize="xs" lineHeight="1.65" color={dark ? "whiteAlpha.700" : "gray.700"}>
                        {tr(
                          "ViT의 1위 확률이나 1·2위 차이가 작습니다. 현재는 보수적인 baseline 경고이며 확정적인 unknown 판정은 아닙니다.",
                          "The ViT top-1 confidence or top-1/top-2 margin is low. This is a conservative baseline warning, not a calibrated unknown-breed probability."
                        )}
                      </Text>
                    </Box>
                  )}

                  <Stack spacing="3.5">
                    {selectedPredictions.map((prediction, index) => (
                      <Box key={`${prediction.label}-${index}`}>
                        <Flex align="baseline" mb="1.5">
                          <Text flex="1" minW="0" fontSize="sm" fontWeight={index === 0 ? "700" : "500"} textTransform="capitalize" noOfLines={1}>{prediction.label}</Text>
                          <Text ml="3" fontSize="xs" color={dark ? "whiteAlpha.500" : "gray.500"}>{(prediction.confidence * 100).toFixed(1)}%</Text>
                        </Flex>
                        <Progress value={prediction.confidence * 100} size="xs" colorScheme={index === 0 ? "pink" : "purple"} borderRadius="full" bg={dark ? "whiteAlpha.100" : "blackAlpha.100"} />
                      </Box>
                    ))}
                  </Stack>

                  <Box mt="7" pt="6" borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
                    <Text fontSize="sm" fontWeight="800">
                      {tr("고급 모델 비교", "Advanced model comparison")}
                    </Text>
                    <Text mt="1.5" fontSize="xs" lineHeight="1.65" color={dark ? "whiteAlpha.500" : "gray.500"}>
                      {tr(
                        "필요할 때만 추가 모델을 로드합니다. SigLIP2는 37개 지원 품종을 zero-shot으로 다시 비교하고, DINOv2는 CLIP과 다른 시각 특징 공간의 검색 순위를 보여줍니다.",
                        "Extra models are loaded only on demand. SigLIP2 re-checks the 37 supported breeds zero-shot, while DINOv2 provides a visual retrieval ranking from a different feature space than CLIP."
                      )}
                    </Text>

                    <Stack direction={["column", "row"]} spacing="3" mt="4">
                      <Button
                        size="sm"
                        variant="outline"
                        borderRadius="10px"
                        isLoading={isSiglipComparing}
                        loadingText="SigLIP2"
                        onClick={onSiglipCompare}
                      >
                        {tr("SigLIP2 보조 판정", "Run SigLIP2 check")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        borderRadius="10px"
                        isLoading={isRetrievalComparing}
                        loadingText="DINOv2"
                        onClick={onRetrievalCompare}
                      >
                        {tr("CLIP · DINOv2 비교", "Compare CLIP · DINOv2")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        borderRadius="10px"
                        isLoading={isPoseAnalyzing}
                        loadingText="Pose"
                        onClick={onPoseAnalyze}
                      >
                        {tr("동물 포즈 추정", "Estimate animal pose")}
                      </Button>
                    </Stack>

                    {advancedError && (
                      <Text mt="3" fontSize="xs" color={dark ? "red.200" : "red.600"}>
                        {advancedError}
                      </Text>
                    )}

                    {poseError && (
                      <Text mt="3" fontSize="xs" color={dark ? "red.200" : "red.600"}>
                        {poseError}
                      </Text>
                    )}

                    {selectedPose && (
                      <Box mt="5" px="4" py="4" borderRadius="12px" bg={dark ? "#19151d" : "white"} border="1px solid" borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"}>
                        <Text fontSize="10px" fontWeight="800" letterSpacing="0.1em" color="cyan.400">
                          VITPOSE++ · AP-10K
                        </Text>
                        <Text mt="2" fontSize="sm" fontWeight="700">
                          {tr(`${(selectedPose.keypoints || []).length}개 keypoint를 표시했습니다.`, `${(selectedPose.keypoints || []).length} keypoints rendered.`)}
                        </Text>
                        <Text mt="1.5" fontSize="xs" lineHeight="1.65" color={dark ? "whiteAlpha.500" : "gray.500"}>
                          {(selectedPose.keypoints || []).slice(0, 6).map((point) => `${point.label} ${(point.score * 100).toFixed(0)}%`).join(" · ")}
                        </Text>
                      </Box>
                    )}

                    {siglipComparison && (
                      <Box mt="5" px="4" py="4" borderRadius="12px" bg={dark ? "#19151d" : "white"} border="1px solid" borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"}>
                        <Text fontSize="10px" fontWeight="800" letterSpacing="0.1em" color="pink.500">
                          SIGLIP2 · ZERO-SHOT
                        </Text>
                        <Text mt="2" fontSize="sm" fontWeight="700">
                          {siglipComparison.agreement?.same_top1
                            ? tr("ViT와 SigLIP2의 1순위가 일치합니다.", "ViT and SigLIP2 agree on the top-1 breed.")
                            : tr("ViT와 SigLIP2의 1순위가 다릅니다.", "ViT and SigLIP2 disagree on the top-1 breed.")}
                        </Text>
                        <Stack spacing="2" mt="3">
                          {(siglipComparison.siglip2?.results || []).slice(0, 3).map((item, index) => (
                            <Flex key={`${item.id}-${index}`} align="baseline">
                              <Text flex="1" fontSize="xs" textTransform="capitalize">
                                {index + 1}. {item.breed}
                              </Text>
                              <Text ml="3" fontSize="xs" fontWeight="700" color="pink.500">
                                {(item.score * 100).toFixed(1)}%
                              </Text>
                            </Flex>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {retrievalComparison && (
                      <Box mt="5" px="4" py="4" borderRadius="12px" bg={dark ? "#19151d" : "white"} border="1px solid" borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"}>
                        <Text fontSize="10px" fontWeight="800" letterSpacing="0.1em" color="purple.400">
                          CLIP · DINOV2 RETRIEVAL
                        </Text>
                        <Flex mt="3" align="flex-start">
                          <Box flex="1" minW="0">
                            <Text fontSize="xs" fontWeight="800">CLIP</Text>
                            {(retrievalComparison.clip?.matches || []).slice(0, 3).map((item, index) => (
                              <Text key={`clip-${item.id}-${index}`} mt="1.5" fontSize="xs" color={dark ? "whiteAlpha.600" : "gray.600"} noOfLines={1}>
                                {index + 1}. {item.breed}
                              </Text>
                            ))}
                          </Box>
                          <Box flex="1" minW="0" ml="6">
                            <Text fontSize="xs" fontWeight="800">DINOv2</Text>
                            {(retrievalComparison.dino?.matches || []).slice(0, 3).map((item, index) => (
                              <Text key={`dino-${item.id}-${index}`} mt="1.5" fontSize="xs" color={dark ? "whiteAlpha.600" : "gray.600"} noOfLines={1}>
                                {index + 1}. {item.breed}
                              </Text>
                            ))}
                          </Box>
                        </Flex>
                      </Box>
                    )}
                  </Box>

                  <Box mt="6" pt="5" borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
                    <Text fontSize="sm" fontWeight="700">{tr("갤러리가 유사도 순으로 바뀌었습니다", "The gallery is now ranked by similarity")}</Text>
                    <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="xs" lineHeight="1.6" mt="1">
                      {detectedPets.length > 1
                        ? tr("사진의 감지 박스나 개체 카드를 선택하면 해당 반려동물의 CLIP 유사도 순위로 갤러리가 즉시 바뀝니다.", "Select a detection box or pet card to switch the gallery to that pet's CLIP similarity ranking.")
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
