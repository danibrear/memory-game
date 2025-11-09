import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Divider,
  Grid,
  Link,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router";
import { PAGES } from "~/root";
export default function Landing() {
  const navigate = useNavigate();
  return (
    <Box>
      <Container maxWidth="md">
        <Grid container spacing={1}>
          {PAGES.map((page) => (
            <Grid size={{ xs: 6, md: 3 }} key={page.name}>
              <Card>
                <CardActionArea
                  onClick={() => {
                    navigate(page.path);
                  }}>
                  <CardContent>
                    <Typography variant="h5" component="div" gutterBottom>
                      {page.icon}
                      {page.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {page.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      <Divider sx={{ mt: 4 }} />
      <Box sx={{ textAlign: "center" }}>
        <Typography
          variant="h6"
          component={Link}
          href="https://db.rocks"
          target="_blank"
          sx={{ mt: 4, display: "block" }}>
          Made with{" "}
          <FontAwesomeIcon
            icon={faHeart}
            style={{
              color: "red",
              fontSize: "1rem",
            }}
          />{" "}
          by DaniB
        </Typography>
      </Box>
    </Box>
  );
}
