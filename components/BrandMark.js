import Link from "next/link";
import { Box, Flex, Text } from "@chakra-ui/react";

export default function BrandMark({ dark = false, compact = false }) {
  return (
    <Link href="/" passHref>
      <Flex
        as="a"
        align="center"
        minW="0"
        color="inherit"
        textDecoration="none"
        _hover={{ textDecoration: "none" }}
      >
        <Box
          as="img"
          src="/petlens-paw.png"
          alt="PetLens"
          w={compact ? "32px" : "38px"}
          h={compact ? "32px" : "38px"}
          mr={compact ? "2" : "2.5"}
          flexShrink="0"
          style={{ objectFit: "contain" }}
        />
        <Box minW="0">
          <Text
            color={dark ? "white" : "#241c2c"}
            fontWeight="800"
            fontSize={compact ? "lg" : "xl"}
            letterSpacing="-0.045em"
            lineHeight="1"
          >
            PetLens
          </Text>
          {!compact && (
            <Text color={dark ? "whiteAlpha.600" : "gray.500"} fontSize="10px" mt="1" letterSpacing="0.08em">
              VISUAL PET EXPLORER
            </Text>
          )}
        </Box>
      </Flex>
    </Link>
  );
}
