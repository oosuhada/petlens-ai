import Head from "next/head";
import Link from "next/link";
import {
  Box,
  Button,
  Flex,
  Grid,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import { ArrowBackIcon, MoonIcon, SunIcon } from "@chakra-ui/icons";

import BrandMark from "../components/BrandMark";
import usePetLensLocale from "../hooks/usePetLensLocale";

export default function Guide() {
  const { isKo, tr, changeLanguage } = usePetLensLocale();
  const { colorMode, toggleColorMode } = useColorMode();
  const dark = colorMode === "dark";

  const rows = [
    {
      label: "CLIP · TEXT → IMAGE",
      title: tr("점수는 확률이 아닙니다", "A CLIP score is not a probability"),
      body: tr("검색 결과의 숫자는 텍스트와 이미지 임베딩의 유사도입니다. 절대값보다 같은 검색 안에서의 순위를 읽는 것이 중요합니다.", "The score is embedding similarity. Read its relative rank within a search rather than treating it as confidence."),
    },
    {
      label: "VIT · TOP-5",
      title: tr("분류는 37개 클래스 안에서만", "Classification stays inside 37 classes"),
      body: tr("ViT는 Oxford-IIIT Pet의 37개 품종 중 가장 가능성이 높은 후보를 반환합니다. 데이터셋 밖 품종을 새로 만들어내지 않습니다.", "ViT chooses among the 37 Oxford-IIIT Pet breeds; it does not invent classes outside that label set."),
    },
    {
      label: "CLIP · IMAGE → IMAGE",
      title: tr("유사 이미지는 분류 결과와 별개입니다", "Similarity is separate from classification"),
      body: tr("업로드 후 갤러리 순위는 CLIP 이미지 임베딩으로 계산됩니다. ViT 1순위 품종과 항상 같은 순서가 나올 필요는 없습니다.", "After upload, gallery ranking comes from CLIP image embeddings, independently from the ViT top-1 breed."),
    },
  ];

  const usageSections = [
    {
      no: "01",
      label: "GALLERY",
      title: tr("먼저 37개 품종 레퍼런스를 둘러보세요", "Start with the 37-breed reference gallery"),
      body: tr(
        "홈의 기본 상태는 Oxford-IIIT Pet의 37개 품종 레퍼런스를 그대로 보여줍니다. 특정 결과를 해석하기 전에 어떤 품종과 이미지가 기준 집합에 포함되어 있는지 먼저 훑어보면 이후 CLIP과 ViT 결과를 훨씬 쉽게 이해할 수 있습니다.",
        "The home page starts with the complete 37-breed Oxford-IIIT Pet reference set. Before interpreting model output, browse the available breeds and images so you understand the reference space that CLIP and ViT operate within."
      ),
      tip: tr("사진을 선택하면 해당 레퍼런스의 품종, 데이터셋 정보, 모델 지표와 원본 출처를 확인할 수 있습니다.", "Open any photo to inspect its breed, dataset context, model metrics, and original source."),
    },
    {
      no: "02",
      label: "CLIP · TEXT → IMAGE",
      title: tr("품종명이 아니라 장면을 문장으로 검색하세요", "Search by describing the scene, not just the breed"),
      body: tr(
        "홈의 ‘의미 기반 검색’ 카드에 원하는 특징을 영어 문장으로 입력하세요. 예를 들어 ‘a small white fluffy dog’처럼 외형이나 장면을 설명하면 CLIP이 텍스트와 각 이미지의 의미적 유사도를 계산해 37개 갤러리의 순서를 다시 정렬합니다.",
        "In the Semantic Search card, enter an English description such as ‘a small white fluffy dog’. CLIP compares the text embedding with every gallery image and re-ranks all 37 references by semantic similarity."
      ),
      tip: tr("검색 점수는 품종 확률이 아닙니다. 같은 검색 안에서 어떤 이미지가 상대적으로 더 위에 있는지를 보는 용도입니다.", "The score is not breed confidence. Use it to compare relative ranking within the current search."),
    },
    {
      no: "03",
      label: "VIT · PHOTO ANALYSIS",
      title: tr("내 사진은 ‘품종 예측’과 ‘유사 이미지 검색’을 함께 보세요", "Read your upload through classification and similarity together"),
      body: tr(
        "‘품종 분석’ 카드에서 반려동물 사진 한 장을 업로드하면 ViT가 37개 클래스 안에서 Top-5 품종 확률을 반환합니다. 동시에 같은 업로드 이미지를 CLIP으로 임베딩해 갤러리에서 시각적으로 비슷한 레퍼런스를 다시 정렬합니다.",
        "Upload one pet photo in the Breed Analysis card. ViT returns top-5 probabilities across the 37 classes, while CLIP embeds the same image and re-ranks the gallery by visual similarity."
      ),
      tip: tr("ViT 1위 품종과 CLIP 유사 이미지 1위가 달라도 정상입니다. 두 모델은 서로 다른 질문에 답합니다.", "It is normal for ViT top-1 and the most similar CLIP image to differ; the two models answer different questions."),
    },
    {
      no: "04",
      label: "DETAIL VIEW",
      title: tr("상세 화면에서는 결과의 기준과 출처를 확인하세요", "Use the detail view to verify context and source"),
      body: tr(
        "갤러리 카드나 검색 결과를 열면 해당 이미지가 어떤 품종 레퍼런스인지, 데이터셋이 무엇인지, ViT의 과제 평가 지표가 무엇인지 확인할 수 있습니다. ‘출처’ 버튼은 원본 사진 제공 페이지로 연결됩니다.",
        "Open a gallery or search result to see the breed reference, dataset context, and the ViT course evaluation metrics. The Source button links to the original photo provider page."
      ),
      tip: tr("상세 화면의 91.41% 정확도와 91.32% Macro F1은 해당 한 장의 예측 확률이 아니라 전체 평가셋에서 측정한 모델 지표입니다.", "The 91.41% accuracy and 91.32% Macro F1 shown here are evaluation-set metrics, not confidence scores for that individual image."),
    },
  ];

  return (
    <Box minH="100vh" bg={dark ? "#0f0c12" : "#fbfafc"} color={dark ? "white" : "gray.800"}>
      <Head><title>{tr("결과 읽는 법", "Guide")} · PetLens</title></Head>

      <Flex h="68px" px={[3, 6, 8]} align="center" gap="1" borderBottom="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
        <BrandMark dark={dark} compact />
        <Box flex="1" />
        <Link href="/" passHref>
          <Button
            as="a"
            variant="ghost"
            size="sm"
            leftIcon={<ArrowBackIcon />}
            mr={[1, 2]}
            px={[2, 3]}
          >
            {tr("갤러리", "Gallery")}
          </Button>
        </Link>
        <Button size="xs" variant="ghost" mr="1" onClick={() => changeLanguage(isKo ? "en" : "ko")}>{isKo ? "EN" : "한"}</Button>
        <Button size="sm" variant="ghost" px="2" minW="34px" onClick={toggleColorMode}>{dark ? <SunIcon /> : <MoonIcon />}</Button>
      </Flex>

      <Box maxW="980px" mx="auto" px={[5, 7, 9]} pt={[9, 12, 14]} pb={[12, 14, 16]}>
        <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em">MODEL GUIDE</Text>
        <Text fontSize={["3xl", "4xl"]} fontWeight="800" letterSpacing="-0.045em" mt="3">
          {tr("결과를 과하게 읽지 않는 법", "How to read the results")}
        </Text>
        <Text color={dark ? "whiteAlpha.600" : "gray.600"} fontSize="sm" lineHeight="1.8" maxW="690px" mt="4">
          {tr("PetLens는 두 모델을 한 화면에 보여주지만, 두 숫자가 의미하는 바는 다릅니다. 아래 세 가지만 기억하면 됩니다.", "PetLens shows two models in one experience, but their numbers mean different things. Keep these three distinctions in mind.")}
        </Text>

        <Box mt={[10, 12]}>
          <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em">
            HOW TO USE
          </Text>
          <Text fontSize={["2xl", "3xl"]} fontWeight="800" letterSpacing="-0.04em" mt="3">
            {tr("각 섹션은 이렇게 사용하세요", "How to use each section")}
          </Text>
          <Text color={dark ? "whiteAlpha.600" : "gray.600"} fontSize="sm" lineHeight="1.8" maxW="720px" mt="3">
            {tr(
              "홈에서 탐색 → 문장 검색 → 사진 분석 → 상세 확인 순서로 사용하면 각 모델이 무엇을 보여주는지 자연스럽게 연결됩니다.",
              "A useful flow is browse → text search → photo analysis → detail view. Each step adds a different layer of context to the same reference gallery."
            )}
          </Text>

          <Grid mt={[7, 8]} borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
            {usageSections.map((section) => (
              <Grid
                key={section.no}
                templateColumns={["44px 1fr", "64px 1fr", "86px 1fr"]}
                gap={[3, 5, 7]}
                py={[6, 7, 8]}
                borderBottom="1px solid"
                borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
              >
                <Text color="pink.500" fontSize="sm" fontWeight="800">
                  {section.no}
                </Text>
                <Box>
                  <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="10px" fontWeight="800" letterSpacing="0.12em">
                    {section.label}
                  </Text>
                  <Text fontSize={["lg", "xl"]} fontWeight="800" letterSpacing="-0.025em" mt="2">
                    {section.title}
                  </Text>
                  <Text color={dark ? "whiteAlpha.600" : "gray.600"} fontSize="sm" lineHeight="1.8" mt="3">
                    {section.body}
                  </Text>
                  <Box
                    mt="4"
                    px="4"
                    py="3"
                    borderRadius="10px"
                    bg={dark ? "whiteAlpha.50" : "blackAlpha.50"}
                  >
                    <Text color={dark ? "whiteAlpha.700" : "gray.600"} fontSize="xs" lineHeight="1.7">
                      {section.tip}
                    </Text>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box mt={[11, 13]}>
          <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em">
            HOW TO READ RESULTS
          </Text>
          <Text fontSize={["2xl", "3xl"]} fontWeight="800" letterSpacing="-0.04em" mt="3">
            {tr("결과 숫자는 이렇게 읽으세요", "How to interpret the numbers")}
          </Text>
        </Box>

        <Grid mt={[6, 7]} borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
          {rows.map((row) => (
            <Grid key={row.label} templateColumns={["1fr", "190px 1fr"]} gap={[3, 7]} py={[6, 7]} borderBottom="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
              <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.11em">{row.label}</Text>
              <Box>
                <Text fontSize="xl" fontWeight="800" letterSpacing="-0.025em">{row.title}</Text>
                <Text color={dark ? "whiteAlpha.600" : "gray.600"} fontSize="sm" lineHeight="1.75" mt="2">{row.body}</Text>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Box mt={[9, 10]} px={[5, 6]} py={[5, 6]} borderLeft="2px solid" borderColor="pink.400" bg={dark ? "whiteAlpha.50" : "blackAlpha.50"}>
          <Text fontSize="sm" fontWeight="700">{tr("과제 지표와 웹 런타임을 구분합니다.", "Course metrics and web runtime are separate evidence.")}</Text>
          <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="xs" lineHeight="1.7" mt="1">
            {tr("README의 91.41% ViT 정확도와 CLIP Recall@K는 실행된 Colab 노트북의 측정값입니다.", "The 91.41% ViT accuracy and CLIP Recall@K in README come from the executed Colab notebooks.")}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
