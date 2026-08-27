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

  return (
    <Box minH="100vh" bg={dark ? "#0f0c12" : "#fbfafc"} color={dark ? "white" : "gray.800"}>
      <Head><title>{tr("결과 읽는 법", "Guide")} · PetLens</title></Head>

      <Flex h="68px" px={[3, 6, 8]} align="center" gap="1" borderBottom="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
        <Link href="/" passHref><Button as="a" variant="ghost" size="sm" leftIcon={<ArrowBackIcon />} mr="2">{tr("갤러리", "Gallery")}</Button></Link>
        <BrandMark dark={dark} compact />
        <Box flex="1" />
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

        <Grid mt={[8, 10]} borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
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
