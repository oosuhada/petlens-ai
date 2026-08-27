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

  return (
    <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose} finalFocusRef={inputRef}>
      <DrawerOverlay bg="blackAlpha.500" />
      <DrawerContent bg={dark ? "#141118" : "#fbfafc"} color={dark ? "white" : "gray.800"}>
        <DrawerCloseButton top="4" right="4" />
        <DrawerHeader px={[5, 7]} pt="6" pb="4" borderBottom="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
          <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em" mb="2">
            VIT + CLIP
          </Text>
          <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.035em">
            {tr("사진 한 장을 분석하세요", "Analyze one pet photo")}
          </Text>
          <Text color={dark ? "whiteAlpha.600" : "gray.500"} fontSize="sm" fontWeight="400" lineHeight="1.65" mt="2" pr="8">
            {tr(
              "ViT는 37개 품종 중 Top-5를 예측하고, CLIP은 같은 사진을 기준으로 레퍼런스 갤러리를 다시 정렬합니다.",
              "ViT predicts the top five breeds; CLIP re-ranks the reference gallery from the same image."
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
              <Text fontWeight="700">{tr("반려동물이 잘 보이는 사진", "Choose a clear pet photo")}</Text>
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
                  maxH="380px"
                  display="block"
                  style={{ objectFit: "cover", aspectRatio: "4 / 3" }}
                />
                {isAnalyzing && (
                  <Flex position="absolute" inset="0" bg={dark ? "rgba(20,17,24,0.78)" : "rgba(255,255,255,0.82)"} align="center" justify="center" direction="column">
                    <Spinner color="pink.400" thickness="3px" />
                    <Text fontSize="sm" mt="3" color={dark ? "whiteAlpha.800" : "gray.600"}>{tr("두 모델을 실행하고 있습니다…", "Running both models…")}</Text>
                  </Flex>
                )}
              </Box>

              {analysis && (
                <Box>
                  <Flex align="end" justify="space-between" mb="5">
                    <Box minW="0">
                      <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="10px" fontWeight="800" letterSpacing="0.12em">
                        {tr("가장 높은 예측", "TOP PREDICTION")}
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
                      {tr("Drawer를 닫으면 CLIP 이미지 유사도 순위를 바로 확인할 수 있습니다.", "Close this drawer to inspect the CLIP image-similarity ranking.")}
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
