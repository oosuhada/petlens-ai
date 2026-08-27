import Image from "next/image";
import Link from "next/link";
import { Box, Flex, Text, useColorMode } from "@chakra-ui/react";

const ASPECTS = ["4 / 5", "1 / 1", "3 / 4", "5 / 6", "4 / 3", "3 / 4"];

export default function PhotoTile({ photo, index, ranked = false, reducedMotion = false }) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const aspect = ASPECTS[index % ASPECTS.length];

  return (
    <Box mb={[2, 3]} sx={{ breakInside: "avoid" }}>
      <Link href={`/photos/${photo.id}`} passHref>
        <Box
          as="a"
          display="block"
          position="relative"
          overflow="hidden"
          borderRadius={["10px", "12px"]}
          bg={dark ? "#1c1821" : "gray.100"}
          color="white"
          textDecoration="none"
          border="1px solid"
          borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
          transition={reducedMotion ? "none" : "transform 170ms ease, box-shadow 170ms ease"}
          _hover={reducedMotion ? {} : { transform: "translateY(-3px) scale(1.005)", boxShadow: dark ? "0 18px 32px rgba(0,0,0,0.38)" : "0 16px 30px rgba(42,28,48,0.18)" }}
          _focus={{ outline: "none", boxShadow: "0 0 0 3px rgba(236,72,153,0.36)" }}
        >
          <Box position="relative" width="100%" sx={{ aspectRatio: aspect }}>
            <Image src={photo.src.portrait} alt={`${photo.breed} ${photo.species}`} layout="fill" objectFit="cover" quality={72} />
          </Box>
          <Box
            position="absolute"
            inset="auto 0 0 0"
            pt="12"
            px="3"
            pb="3"
            bg="linear-gradient(to top, rgba(8,6,10,0.82), rgba(8,6,10,0.34), transparent)"
          >
            <Flex align="flex-end" gap="2">
              <Box minW="0" flex="1">
                <Text fontWeight="700" fontSize="sm" lineHeight="1.2" noOfLines={1}>{photo.breed}</Text>
                <Text fontSize="10px" color="whiteAlpha.700" mt="1" letterSpacing="0.08em">{photo.species.toUpperCase()}</Text>
              </Box>
              {typeof photo.score === "number" && (
                <Text fontSize="xs" fontWeight="700" color="pink.200">{photo.score.toFixed(3)}</Text>
              )}
            </Flex>
          </Box>
          {ranked && (
            <Flex
              position="absolute"
              top="2.5"
              left="2.5"
              w="27px"
              h="27px"
              align="center"
              justify="center"
              borderRadius="full"
              bg="rgba(8,6,10,0.72)"
              border="1px solid rgba(255,255,255,0.28)"
              fontSize="11px"
              fontWeight="800"
            >
              {index + 1}
            </Flex>
          )}
        </Box>
      </Link>
    </Box>
  );
}
