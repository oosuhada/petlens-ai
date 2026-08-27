import Link from "next/link";
import {
  Box,
  Button,
  Flex,
  IconButton,
  useColorMode,
} from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";

import BrandMark from "./BrandMark";

export default function ExplorerHeader({
  isKo,
  changeLanguage,
  tr,
}) {
  const { colorMode, toggleColorMode } = useColorMode();
  const dark = colorMode === "dark";

  return (
    <Box
      as="header"
      position="sticky"
      top="0"
      zIndex="40"
      bg={dark ? "rgba(16,13,20,0.92)" : "rgba(250,248,252,0.92)"}
      borderBottom="1px solid"
      borderColor={dark ? "whiteAlpha.100" : "blackAlpha.100"}
      style={{ backdropFilter: "blur(18px)" }}
    >
      <Flex
        maxW="1540px"
        mx="auto"
        px={[3, 4, 6]}
        h={["64px", "68px"]}
        align="center"
        gap={[2, 3, 5]}
      >
        <BrandMark dark={dark} compact />
        <Box flex="1" />

        <Flex align="center" gap="1" flexShrink="0">
          <Button
            as="a"
            href="#explore-tools"
            display={["none", "inline-flex"]}
            size="sm"
            variant="ghost"
            color={dark ? "whiteAlpha.700" : "gray.600"}
          >
            {tr("탐색 도구", "Explore")}
          </Button>

          <Link href="/guide" passHref>
            <Button
              as="a"
              display={["none", "none", "inline-flex"]}
              size="sm"
              variant="ghost"
              color={dark ? "whiteAlpha.700" : "gray.500"}
            >
              {tr("가이드", "Guide")}
            </Button>
          </Link>

          <Flex
            display={["none", "flex"]}
            ml={[2, 4, 5]}
            mr={[1, 2, 3]}
            border="1px solid"
            borderColor={dark ? "whiteAlpha.200" : "blackAlpha.100"}
            borderRadius="10px"
            p="1px"
          >
            <Button
              size="xs"
              minW="30px"
              h="28px"
              borderRadius="8px"
              variant="ghost"
              bg={isKo ? (dark ? "whiteAlpha.200" : "blackAlpha.100") : "transparent"}
              color={dark ? "white" : "gray.700"}
              onClick={() => changeLanguage("ko")}
            >
              한
            </Button>
            <Button
              size="xs"
              minW="36px"
              h="28px"
              borderRadius="8px"
              variant="ghost"
              bg={!isKo ? (dark ? "whiteAlpha.200" : "blackAlpha.100") : "transparent"}
              color={dark ? "white" : "gray.700"}
              onClick={() => changeLanguage("en")}
            >
              EN
            </Button>
          </Flex>

          <IconButton
            aria-label={dark ? "라이트 모드" : "다크 모드"}
            icon={dark ? <SunIcon /> : <MoonIcon />}
            ml={[1, 2, 3]}
            size="sm"
            variant="ghost"
            color={dark ? "yellow.200" : "purple.700"}
            onClick={toggleColorMode}
          />
        </Flex>
      </Flex>
    </Box>
  );
}
