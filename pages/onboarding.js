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
import { ArrowForwardIcon, MoonIcon, SunIcon } from "@chakra-ui/icons";

import BrandMark from "../components/BrandMark";
import usePetLensLocale from "../hooks/usePetLensLocale";

export default function Onboarding() {
  const { isKo, tr, changeLanguage } = usePetLensLocale();
  const { colorMode, toggleColorMode } = useColorMode();
  const dark = colorMode === "dark";

  const steps = [
    {
      no: "01",
      title: tr("갤러리를 훑어보세요", "Browse the gallery"),
      body: tr("홈은 37개 품종 사진이 바로 보이는 탐색 화면입니다.", "Home opens directly into all 37 breed references."),
      meta: tr("사진이 먼저", "PHOTO FIRST"),
    },
    {
      no: "02",
      title: tr("문장으로 순서를 바꾸세요", "Re-rank with a sentence"),
      body: tr("영어 설명을 입력하면 CLIP이 같은 갤러리를 의미 유사도 순으로 다시 정렬합니다.", "Describe what you want and CLIP re-ranks the same gallery by semantic similarity."),
      meta: "CLIP · TEXT → IMAGE",
    },
    {
      no: "03",
      title: tr("사진을 한 장 분석하세요", "Analyze one photo"),
      body: tr("분석 Drawer에서 ViT Top-5와 CLIP 이미지 유사 검색을 동시에 실행합니다.", "The analysis drawer runs ViT top-5 classification and CLIP image similarity together."),
      meta: "VIT + CLIP",
    },
  ];

  return (
    <Box minH="100vh" bg={dark ? "#0f0c12" : "#fbfafc"} color={dark ? "white" : "gray.800"}>
      <Head><title>{tr("시작하기", "Onboarding")} · PetLens</title></Head>

      <Flex
        h="68px"
        px={[3, 6, 8]}
        align="center"
        borderBottom="1px solid"
        borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
      >
        <BrandMark dark={dark} compact />
        <Box flex="1" />
        <Button size="xs" variant="ghost" mr="1" onClick={() => changeLanguage(isKo ? "en" : "ko")}>{isKo ? "EN" : "한"}</Button>
        <Button size="sm" variant="ghost" px="2" minW="34px" onClick={toggleColorMode}>{dark ? <SunIcon /> : <MoonIcon />}</Button>
      </Flex>

      <Box maxW="1180px" mx="auto" px={[5, 7, 9]} pt={[9, 12, 14]} pb={[12, 14, 16]}>
        <Flex direction={["column", "column", "row"]} align="flex-start">
          <Box width={["100%", "100%", "34%"]} mb={[8, 10, 0]} mr={[0, 0, 14]} position={["static", "static", "sticky"]} top="94px">
            <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em">ONBOARDING</Text>
            <Text fontSize={["3xl", "4xl"]} fontWeight="800" letterSpacing="-0.045em" lineHeight="1.08" mt="3">
              <Box as="span" display="block" whiteSpace="nowrap">{tr("세 단계면", "Three steps,")}</Box>
              <Box as="span" display="block" whiteSpace="nowrap">{tr("충분합니다.", "that is enough.")}</Box>
            </Text>
            <Text color={dark ? "whiteAlpha.600" : "gray.600"} fontSize="sm" lineHeight="1.8" mt="5" maxW="360px">
              {tr("PetLens는 별도의 대시보드가 아니라 하나의 사진 갤러리에서 검색과 분석이 이어지는 서비스입니다.", "PetLens is not a dashboard. Search and analysis both happen around the same photo gallery.")}
            </Text>
            <Link href="/" passHref>
              <Button as="a" mt="6" rightIcon={<ArrowForwardIcon />} bg="pink.500" color="white" borderRadius="10px" _hover={{ bg: "pink.600" }}>
                {tr("탐색 시작", "Start exploring")}
              </Button>
            </Link>
          </Box>

          <Grid width={["100%", "100%", "auto"]} flex="1" minW="0" gap="0" borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
            {steps.map((step) => (
              <Grid
                key={step.no}
                templateColumns={["48px 1fr", "64px 1fr"]}
                gap={[3, 5]}
                py={[6, 8]}
                borderBottom="1px solid"
                borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
              >
                <Text color="pink.500" fontSize="sm" fontWeight="800">{step.no}</Text>
                <Box>
                  <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="10px" fontWeight="800" letterSpacing="0.12em">{step.meta}</Text>
                  <Text fontSize={["xl", "2xl"]} fontWeight="800" letterSpacing="-0.03em" mt="2">{step.title}</Text>
                  <Text color={dark ? "whiteAlpha.600" : "gray.600"} fontSize="sm" lineHeight="1.75" mt="3" maxW="620px">{step.body}</Text>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Flex>
      </Box>
    </Box>
  );
}
