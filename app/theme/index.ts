import { createTheme } from "@mui/material";

export const PRIMARY = "#3d8496";
export const SECONDARY = "#6b6b8d";
export const SUCCESS = "#7ab800";
export const ERROR = "#df4a35";
export const INFO = "#3d8496";
export const WARNING = "#e6c36a";

export const BACKGROUND = "#f3eddf";
export const DARK_BACKGROUND = "#000";

export const theme = createTheme({
  colorSchemes: {
    dark: true,
  },
  palette: {
    primary: {
      main: PRIMARY,
    },
    success: {
      main: SUCCESS,
    },
    info: {
      main: INFO,
    },
    warning: {
      main: WARNING,
    },
    secondary: {
      main: SECONDARY,
    },
    error: {
      main: ERROR,
    },
  },
  typography: {
    h1: {
      fontSize: "2.2rem",
    },
    h2: {
      fontSize: "2rem",
    },
    h3: {
      fontSize: "1.8rem",
    },
    h4: {
      fontSize: "1.6rem",
    },
    h5: {
      fontSize: "1.4rem",
    },
    h6: {
      fontSize: "1.2rem",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: "50px" },
        contained: {
          color: "white",
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: "#343434",
        },
        h1: {
          color: PRIMARY,
        },
        h2: {
          color: PRIMARY,
        },
        h3: {
          color: SECONDARY,
        },
        h4: {
          color: SECONDARY,
        },
        h5: {
          color: PRIMARY,
        },
        h6: {
          color: PRIMARY,
        },
      },
    },
  },
});
