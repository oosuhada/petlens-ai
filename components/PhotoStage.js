import { useState } from "react";
import { Badge, Box, Flex, Grid, Heading, Text, useColorMode } from "@chakra-ui/react";

import useReducedMotionPreference from "../hooks/useReducedMotionPreference";

function FeaturedCard({ photo, position, pointer, depth, reducedMotion, dark }) {
  if (!photo) return null;

  const offsetX = reducedMotion ? 0 : pointer.x * depth;
  const offsetY = reducedMotion ? 0 : pointer.y * depth * 0.5;
  const rotation = Number.parseFloat(position.rotate) || 0;

  return (
    <Box
      position="absolute"
      width={position.width}
      height={position.height}
      right={position.right}
      top={position.top}
      zIndex={position.zIndex}
      transform={`translate3d(${offsetX}px, ${offsetY}px, ${depth}px) rotate(${rotation + (reducedMotion ? 0 : pointer.x * 1.8)}deg)`}
      transformStyle="preserve-3d"
      transition={reducedMotion ? "none" : "transform 120ms ease-out"}
    >
      <Box
        position="relative"
        width="100%"
        height="100%"
        overflow="hidden"
        borderRadius={["14px", "18px", "20px"]}
        bg={dark ? "#20222b" : "#ebe7ee"}
        boxShadow={dark ? "0 24px 52px rgba(0,0,0,.42)" : "0 24px 54px rgba(48,31,58,.24)"}
        border="1px solid"
        borderColor={dark ? "whiteAlpha.300" : "whiteAlpha.800"}
      >
        <Box
          as="img"
          src={photo.src.portrait}
          alt={`${photo.breed} ${photo.species}`}
          loading="eager"
          position="absolute"
          inset="0"
          width="100%"
          height="100%"
          objectFit="cover"
          display="block"
        />
        <Box
          position="absolute"
          inset="0"
          bg="linear-gradient(180deg, transparent 48%, rgba(8,9,14,.72) 100%)"
        />
        <Text
          position="absolute"
          left="3.5"
          bottom="3"
          color="white"
          fontWeight="800"
          fontSize="xs"
          letterSpacing="-0.01em"
          textShadow="0 2px 12px rgba(0,0,0,.3)"
        >
          {photo.breed}
        </Text>
      </Box>
    </Box>
  );
}

export default function PhotoStage({ featured, tr }) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const reducedMotion = useReducedMotionPreference();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const handleMove = (event) => {
    if (reducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    });
  };

  const reset = () => setPointer({ x: 0, y: 0 });
  const samoyed = featured.find((photo) => photo?.id === "samoyed") || featured[0];
  const newfoundland = featured.find((photo) => photo?.id === "newfoundland") || featured[1];
  const ragdoll = featured.find((photo) => photo?.id === "ragdoll") || featured[2];

  return (
    <Box
      as="section"
      borderBottom="1px solid"
      borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
      bg={dark ? "#100d14" : "#f8f5fa"}
      onMouseMove={handleMove}
      onMouseLeave={reset}
    >
      <Grid
        maxW="1540px"
        mx="auto"
        px={[4, 6, 8]}
        py={[5, 6, 7]}
        minH={["300px", "320px", "330px"]}
        templateColumns={["1fr", "1fr", "minmax(0, 1.05fr) minmax(360px, .95fr)"]}
        alignItems="stretch"
      >
        <Flex direction="column" justify="center" zIndex="4" pr={[0, 0, 8]} py={[2, 3]}>
          <Text
            color="pink.500"
            fontSize="10px"
            fontWeight="800"
            letterSpacing="0.16em"
            mb="2"
            whiteSpace="nowrap"
          >
            OXFORD-IIIT PET · 37 BREEDS
          </Text>
          <Heading
            as="h1"
            color={dark ? "white" : "#241c2c"}
            fontSize={["3xl", "4xl", "5xl"]}
            lineHeight="1.06"
            letterSpacing="-0.05em"
            fontWeight="780"
          >
            <Box as="span" display="block" whiteSpace="nowrap">
              {tr("사진을 탐색하고,", "Explore the gallery,")}
            </Box>
            <Box as="span" display="block" whiteSpace="nowrap">
              {tr("의미로 다시 찾으세요.", "then search by meaning.")}
            </Box>
          </Heading>
          <Text
            color={dark ? "whiteAlpha.700" : "gray.600"}
            fontSize={["sm", "md"]}
            lineHeight="1.75"
            mt="4"
            maxW="560px"
            wordBreak="keep-all"
          >
            {tr(
              "Oxford-IIIT Pet의 37개 품종을 사진 중심으로 둘러보고, CLIP 검색과 ViT 분석으로 같은 갤러리를 다른 관점에서 탐색합니다.",
              "Browse all 37 Oxford-IIIT Pet breeds, then explore the same gallery through CLIP retrieval and ViT analysis."
            )}
          </Text>
        </Flex>

        <Box
          position="relative"
          minH={["190px", "220px", "330px"]}
          overflow="hidden"
          mt={[5, 6, 0]}
          style={{ perspective: "1000px" }}
        >
          <Box
            position="absolute"
            inset="5% 0 5% 0"
            borderRadius="28px"
            bg={
              dark
                ? "radial-gradient(circle at 82% 18%, rgba(139,92,246,.24), transparent 34%), radial-gradient(circle at 50% 92%, rgba(244,114,182,.18), transparent 30%)"
                : "radial-gradient(circle at 82% 18%, rgba(139,92,246,.16), transparent 34%), radial-gradient(circle at 50% 92%, rgba(244,114,182,.16), transparent 30%)"
            }
          />

          <FeaturedCard
            photo={samoyed}
            pointer={pointer}
            depth={16}
            reducedMotion={reducedMotion}
            dark={dark}
            position={{ width: "42%", height: "68%", right: "7%", top: "11%", rotate: "5deg", zIndex: 3 }}
          />
          <FeaturedCard
            photo={ragdoll}
            pointer={pointer}
            depth={10}
            reducedMotion={reducedMotion}
            dark={dark}
            position={{ width: "38%", height: "61%", right: "39%", top: "27%", rotate: "-6deg", zIndex: 2 }}
          />
          <FeaturedCard
            photo={newfoundland}
            pointer={pointer}
            depth={20}
            reducedMotion={reducedMotion}
            dark={dark}
            position={{ width: "31%", height: "51%", right: "2%", top: "52%", rotate: "2deg", zIndex: 4 }}
          />

          <Badge
            position="absolute"
            right={[3, 5]}
            top={[3, 5]}
            zIndex="7"
            borderRadius="full"
            px="3"
            py="2"
            bg={dark ? "rgba(20,17,25,.78)" : "rgba(255,255,255,.88)"}
            color={dark ? "whiteAlpha.800" : "gray.700"}
            fontSize="9px"
            fontWeight="800"
            letterSpacing="0.12em"
            boxShadow="0 8px 24px rgba(10,11,16,.10)"
          >
            37 BREEDS · CAT &amp; DOG
          </Badge>
        </Box>
      </Grid>
    </Box>
  );
}
