import { ChakraProvider, ColorModeScript, extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  fonts: {
    heading: 'Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: 'Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  colors: {
    petlens: {
      50: "#fbf8ff",
      100: "#f1e8f7",
      200: "#dfcce9",
      400: "#d86aa0",
      500: "#c64f89",
      600: "#aa3d74",
      700: "#71385e",
      900: "#241c2c",
    },
  },
  styles: {
    global: {
      "html, body, #__next": {
        minHeight: "100%",
      },
      body: {
        margin: 0,
        overflowX: "hidden",
        background: "#fbfafc",
      },
      "*": {
        boxSizing: "border-box",
      },
      "*::selection": {
        background: "#f2bad5",
        color: "#241c2c",
      },
      "button, a, input": {
        WebkitTapHighlightColor: "transparent",
      },
    },
  },
});

function MyApp({ Component, pageProps }) {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <Component {...pageProps} />
      </ChakraProvider>
    </>
  );
}

export default MyApp;
