import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import {
  Box,
  Button,
  Flex,
  IconButton,
  Stack,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import { ArrowBackIcon, ExternalLinkIcon, MoonIcon, SunIcon } from "@chakra-ui/icons";

import BrandMark from "../../components/BrandMark";
import usePetLensLocale from "../../hooks/usePetLensLocale";
import { getPhotoById } from "../../lib/api";

export default function PhotoDetail({ pic }) {
  const { isKo, tr, changeLanguage } = usePetLensLocale();
  const { colorMode, toggleColorMode } = useColorMode();
  const dark = colorMode === "dark";

  if (!pic) return null;

  return (
    <Box minH="100vh" bg={dark ? "#0d0b0f" : "#f6f4f7"} color={dark ? "white" : "gray.800"} overflowX="hidden">
      <Head>
        <title>{pic.breed} · PetLens</title>
        <meta name="description" content={`${pic.breed} in the Oxford-IIIT Pet reference gallery.`} />
      </Head>

      <Flex
        as="header"
        h={["62px", "68px"]}
        align="center"
        px={[3, 5, 7]}
        borderBottom="1px solid"
        borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
        bg={dark ? "rgba(13,11,15,0.94)" : "rgba(250,249,251,0.94)"}
        style={{ backdropFilter: "blur(16px)" }}
        position="sticky"
        top="0"
        zIndex="20"
      >
        <Link href="/" passHref>
          <IconButton as="a" aria-label={tr("갤러리로 돌아가기", "Back to gallery")} icon={<ArrowBackIcon />} variant="ghost" mr="2" />
        </Link>
        <BrandMark dark={dark} compact />
        <Box flex="1" />
        <Flex align="center" gap="1">
          <Button size="xs" variant="ghost" onClick={() => changeLanguage(isKo ? "en" : "ko")}>{isKo ? "EN" : "한"}</Button>
          <IconButton aria-label={dark ? "라이트 모드" : "다크 모드"} icon={dark ? <SunIcon /> : <MoonIcon />} size="sm" variant="ghost" onClick={toggleColorMode} />
        </Flex>
      </Flex>

      <Flex direction={["column", "column", "row"]} minH={["auto", "auto", "calc(100vh - 68px)"]}>
        <Flex
          flex={["none", "none", "1"]}
          minW="0"
          minH={["56vh", "64vh", "calc(100vh - 68px)"]}
          bg="#09080a"
          align="center"
          justify="center"
          position="relative"
          overflow="hidden"
        >
          <Box position="absolute" inset="0" opacity="0.22" filter="blur(46px)" transform="scale(1.08)">
            <Image src={pic.src.original} alt="" layout="fill" objectFit="cover" quality={18} />
          </Box>
          <Box position="absolute" inset="0" bg="rgba(8,7,9,0.42)" />
          <Box position="absolute" inset={["18px", "26px", "34px"]}>
            <Image
              src={pic.src.original}
              alt={`${pic.breed} ${pic.species}`}
              layout="fill"
              objectFit="contain"
              quality={86}
              priority
            />
          </Box>
        </Flex>

        <Box
          width={["100%", "100%", "360px", "420px"]}
          flexShrink="0"
          bg={dark ? "#151219" : "#fbfafc"}
          borderLeft={["0", "0", "1px solid"]}
          borderTop={["1px solid", "1px solid", "0"]}
          borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
          px={[5, 7]}
          py={[6, 8]}
        >
          <Text color="pink.500" fontSize="10px" fontWeight="800" letterSpacing="0.16em">
            OXFORD-IIIT PET · REFERENCE
          </Text>
          <Text fontSize={["3xl", "4xl"]} fontWeight="800" letterSpacing="-0.045em" lineHeight="1.02" mt="3">
            {pic.breed}
          </Text>
          <Text color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="xs" fontWeight="800" letterSpacing="0.12em" mt="3">
            {pic.species.toUpperCase()}
          </Text>

          <Stack spacing="0" mt="8" borderTop="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}>
            <InfoRow label={tr("데이터셋", "Dataset")} value="Oxford-IIIT Pet" dark={dark} />
            <InfoRow label={tr("분류 클래스", "Classes")} value="37" dark={dark} />
            <InfoRow label={tr("ViT 정확도", "ViT accuracy")} value="91.41%" dark={dark} />
            <InfoRow label={tr("Macro F1", "Macro F1")} value="91.32%" dark={dark} />
          </Stack>

          <Box mt="8">
            <Text fontWeight="700" fontSize="sm">{tr("이 화면은 무엇을 보여주나요?", "What does this view represent?")}</Text>
            <Text color={dark ? "whiteAlpha.600" : "gray.600"} fontSize="sm" lineHeight="1.75" mt="2">
              {tr(
                "이 사진은 PetLens가 탐색하는 37개 품종 레퍼런스 중 하나입니다. 검색 결과에서는 CLIP 점수로 순서가 바뀌고, 업로드 분석에서는 ViT 예측과 독립적으로 유사 이미지 후보가 됩니다.",
                "This image is one of the 37 PetLens references. CLIP changes its rank during search, while upload analysis compares it independently from the ViT prediction."
              )}
            </Text>
          </Box>

          <Flex mt="8" gap="3" direction={["column", "row", "column", "row"]}>
            <Link href="/" passHref>
              <Button as="a" flex="1" borderRadius="10px" bg="pink.500" color="white" _hover={{ bg: "pink.600" }}>
                {tr("갤러리로", "Gallery")}
              </Button>
            </Link>
            <Button
              as="a"
              href={pic.photographer_url}
              target="_blank"
              rel="noopener noreferrer"
              flex="1"
              borderRadius="10px"
              variant="outline"
              rightIcon={<ExternalLinkIcon />}
            >
              {tr("출처", "Source")}
            </Button>
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}

function InfoRow({ label, value, dark }) {
  return (
    <Flex py="4" borderBottom="1px solid" borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"} align="baseline" gap="4">
      <Text flex="1" color={dark ? "whiteAlpha.500" : "gray.500"} fontSize="xs">{label}</Text>
      <Text fontSize="sm" fontWeight="700">{value}</Text>
    </Flex>
  );
}

export async function getServerSideProps({ params }) {
  const pic = await getPhotoById(params.id);
  if (!pic) return { notFound: true };
  return { props: { pic } };
}
