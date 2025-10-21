import { Box, Button, Container, Grid } from "@mui/material";
export default function Landing() {
  return (
    <Box>
      <Container maxWidth="md" sx={{ textAlign: "center" }}>
        <Box
          component="h1"
          sx={{ fontSize: "2.5rem", fontWeight: "bold", mb: 2 }}>
          Welcome to DaniB's games!
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              component="h2"
              sx={{ fontSize: "1.5rem", fontWeight: "bold", mb: 1 }}>
              Memory Game
            </Box>
            <Box sx={{ mb: 2 }}>
              Test your memory skills with this fun and challenging game!
            </Box>
            <Button
              variant="contained"
              color="primary"
              href="/memory"
              sx={{ fontWeight: "bold" }}>
              Play Memory Game
            </Button>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              component="h2"
              sx={{ fontSize: "1.5rem", fontWeight: "bold", mb: 1 }}>
              Color Game
            </Box>
            <Box sx={{ mb: 2 }}>
              Like memory game but the squares can be toggled to different
              colors
            </Box>
            <Button
              variant="contained"
              color="primary"
              href="/color"
              sx={{ fontWeight: "bold" }}>
              Play Color Game
            </Button>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
