import {
  faFaceSmileBeam,
  faGlasses,
  faHeart,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { theme } from "~/theme";
import { useLocalStorageState } from "~/utils/useLocalStoredState";

export default function Welcome() {
  const {
    value: isWelcomeShown,
    setValue: setIsWelcomeShown,
    isLoading: isWelcomeLoading,
    isError: isWelcomeError,
  } = useLocalStorageState<boolean>("welcome-shown", true);
  return (
    <Dialog open={isWelcomeShown}>
      <DialogTitle>Welcome to my games!</DialogTitle>
      <DialogContent>
        <Typography>
          These games are provided for free and are not affiliated with any
          company. Any game state is stored in your browser and nothing is ever
          tracked. Enjoy!
        </Typography>
        <Typography sx={{ textAlign: "right" }}>
          <FontAwesomeIcon
            icon={faHeart}
            bounce
            style={{
              color: "red",
              fontSize: "1rem",
            }}
          />{" "}
          DaniB
        </Typography>
      </DialogContent>
      <DialogActions sx={{ flexDirection: "column", gap: 1, mb: 2 }}>
        <Button
          onClick={() => setIsWelcomeShown(false)}
          variant="contained"
          sx={{ fontWeight: "bold" }}
          startIcon={<FontAwesomeIcon icon={faGlasses} />}
          fullWidth>
          Okay nerd, lemme play!
        </Button>
        <Typography variant="caption" sx={{ opacity: 0.666 }}>
          (I love being a nerd! ~DB)
          <FontAwesomeIcon
            style={{ marginLeft: 4, marginTop: 10 }}
            icon={faFaceSmileBeam}
            size="lg"
            color={theme.palette.primary.main}
          />
        </Typography>
      </DialogActions>
    </Dialog>
  );
}
