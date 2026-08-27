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
  Spinner,
  Stack,
  Text,
  useColorMode,
} from "@chakra-ui/react";

const motionLabel = (status, tr) => ({
  mostly_stationary: tr("거의 정지", "Mostly stationary"),
  moving: tr("이동 중", "Moving"),
  high_motion: tr("움직임 큼", "High motion"),
  not_tracked: tr("추적 실패", "Not tracked"),
}[status] || status || "-");

export default function VideoAnalyzeDrawer({
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

  return (
    <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose}>
      <DrawerOverlay bg="blackAlpha.500" />
      <DrawerContent bg={dark ? "#141118" : "#fbfafc"} color={dark ? "white" : "gray.800"}>
        <DrawerCloseButton top="4" right="4" />
        <DrawerHeader px={[5, 7]} pt="6" pb="4" borderBottom="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
          <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em" mb="2">
            PETLENS 2.0 · VIDEO + SAM2 TRACKING
          </Text>
          <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.035em">
            {tr("영상 속 반려동물을 추적하세요", "Track pets through a video")}
          </Text>
          <Text mt="2" pr="8" fontSize="sm" lineHeight="1.65" color={dark ? "whiteAlpha.600" : "gray.500"} fontWeight="400">
            {tr(
              "첫 프레임에서 반려동물을 찾고 SAM2가 샘플 프레임 전체를 추적합니다. 대표 프레임의 품종 예측과 CLIP 유사 이미지도 함께 집계합니다.",
              "PetLens detects pets on the first frame, tracks them with SAM2, and aggregates breed predictions plus CLIP retrieval across representative frames."
            )}
          </Text>
        </DrawerHeader>

        <DrawerBody px={[5, 7]} pt="6" pb="9">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mov,.m4v"
            onChange={onFile}
            style={{ display: "none" }}
          />

          {!previewUrl ? (
            <Box border="1px dashed" borderColor={dark ? "whiteAlpha.300" : "blackAlpha.300"} bg={dark ? "whiteAlpha.50" : "white"} borderRadius="16px" p={[7, 9]} textAlign="center">
              <Text fontWeight="700">{tr("짧은 반려동물 영상을 선택하세요", "Choose a short pet video")}</Text>
              <Text mt="2" fontSize="xs" color={dark ? "whiteAlpha.500" : "gray.500"}>MP4, WebM, MOV · 80MB max</Text>
              <Button mt="6" minH="48px" px="6" bg="pink.500" color="white" borderRadius="10px" _hover={{ bg: "pink.600" }} onClick={() => inputRef.current?.click()}>
                {tr("영상 선택", "Choose video")}
              </Button>
            </Box>
          ) : (
            <Stack spacing="5">
              <Box position="relative" borderRadius="16px" overflow="hidden" bg="#09080a">
                <Box as="video" src={previewUrl} controls playsInline width="100%" maxH="360px" display="block" />
                {isAnalyzing && (
                  <Flex position="absolute" inset="0" align="center" justify="center" direction="column" bg={dark ? "rgba(20,17,24,0.82)" : "rgba(255,255,255,0.86)"}>
                    <Spinner color="pink.400" thickness="3px" />
                    <Text mt="3" px="6" textAlign="center" fontSize="sm">
                      {tr("프레임을 샘플링하고 SAM2 추적을 실행하고 있습니다…", "Sampling frames and running SAM2 tracking…")}
                    </Text>
                  </Flex>
                )}
              </Box>

              {analysis && (
                <Box>
                  <Box px="4" py="3" mb="5" borderRadius="12px" bg={dark ? "whiteAlpha.50" : "blackAlpha.50"}>
                    <Text fontSize="xs" fontWeight="800" color="pink.500">VIDEO SUMMARY</Text>
                    <Text mt="1.5" fontSize="sm" fontWeight="700">
                      {tr(`${analysis.detected_pet_count || 0}마리 · ${analysis.video?.sampled_frame_count || 0}개 프레임 분석`, `${analysis.detected_pet_count || 0} pets · ${analysis.video?.sampled_frame_count || 0} sampled frames`)}
                    </Text>
                    <Text mt="1" fontSize="xs" color={dark ? "whiteAlpha.500" : "gray.500"}>
                      {analysis.video?.duration_seconds != null ? `${analysis.video.duration_seconds.toFixed(1)}s · ` : ""}SAM2 · ViT · CLIP
                    </Text>
                  </Box>

                  <Stack spacing="4">
                    {(analysis.tracks || []).map((track, index) => {
                      const top = track.predictions?.[0];
                      return (
                        <Box key={track.id} px="4" py="4" border="1px solid" borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"} borderRadius="12px" bg={dark ? "#19151d" : "white"}>
                          <Flex align="baseline">
                            <Text flex="1" minW="0" fontSize="10px" fontWeight="800" color="pink.500" letterSpacing="0.1em">
                              TRACK {index + 1} · {String(track.species || "pet").toUpperCase()} · {track.classifier?.scope === "dog130" ? "DOG-130" : "PET-37"}
                            </Text>
                            <Text ml="4" fontSize="10px" color={dark ? "whiteAlpha.500" : "gray.500"}>
                              {(track.timeline || []).length} FRAMES
                            </Text>
                          </Flex>
                          <Flex mt="2" align="baseline">
                            <Text flex="1" minW="0" fontSize="lg" fontWeight="800" textTransform="capitalize" noOfLines={1}>{top?.label || "-"}</Text>
                            <Text ml="4" color="pink.500" fontWeight="800">{top ? `${(top.confidence * 100).toFixed(1)}%` : "-"}</Text>
                          </Flex>
                          <Text mt="2" fontSize="xs" color={dark ? "whiteAlpha.600" : "gray.600"}>
                            {tr("움직임", "Motion")} · {motionLabel(track.motion?.status, tr)}
                          </Text>
                          {(track.matches || []).length > 0 && (
                            <Text mt="2" fontSize="xs" color={dark ? "whiteAlpha.500" : "gray.500"} noOfLines={2}>
                              {tr("유사 이미지", "Similar")} · {(track.matches || []).slice(0, 3).map((photo) => photo.breed).join(" · ")}
                            </Text>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}

          {analysisError && <Text mt="4" fontSize="sm" color={dark ? "red.200" : "red.600"}>{analysisError}</Text>}
        </DrawerBody>

        <DrawerFooter px={[5, 7]} py="5" borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
          {previewUrl && (
            <Button mr="auto" variant="ghost" size="sm" isDisabled={isAnalyzing} onClick={() => inputRef.current?.click()}>
              {tr("다른 영상 선택", "Choose another")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>{tr("닫기", "Close")}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
