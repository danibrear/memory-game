import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Container, Stack, Typography } from "@mui/material";

export default function ElRoute() {
  return (
    <Container maxWidth="md">
      <Typography variant="h1" sx={{ mt: 3, mb: 1 }}>
        Hey baby E!
      </Typography>
      <Typography>
        Hey my love, this is Daddy and I wanted to make this special page just
        for you. I hope you know how proud I am of you and that you're the best
        thing that's ever happened to me. I love you to the moon and back,
        forever and always. I can't wait to see all the amazing things you'll do
        as you grow up. You're my little star, shining so bright!
      </Typography>
      <Typography sx={{ textAlign: "right", mt: 2, fontStyle: "italic" }}>
        With all my love,
        <br />
        Daddy.
      </Typography>

      <Stack direction="row" spacing={0} justifyContent="center" sx={{ mt: 4 }}>
        <Typography sx={{ mr: 0.5 }}>DB</Typography>
        <FontAwesomeIcon icon={faHeart} size="xl" color="red" bounce />
        <Typography>'s EB</Typography>
      </Stack>
    </Container>
  );
}
