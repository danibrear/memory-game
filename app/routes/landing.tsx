import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Grid,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router";
export default function Landing() {
  const navigate = useNavigate();
  return (
    <Box>
      <Container maxWidth="md" sx={{ textAlign: "center" }}>
        <Box>
          <Typography>Welcome to DaniB's games!</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card>
              <CardActionArea
                onClick={() => {
                  navigate("/memory");
                }}>
                <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    Memory Game
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Test your memory skills by matching pairs of colors in this
                    exciting Memory Game!
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card>
              <CardActionArea
                onClick={() => {
                  navigate("/color");
                }}>
                <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    Color Game
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Color in the grid by selecting cells
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card>
              <CardActionArea
                onClick={() => {
                  navigate("/match");
                }}>
                <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    Match Game
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Match pairs of colors in this exciting game!
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
