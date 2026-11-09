# 08: Year 3 face-on climb

**What to build:** At the end of Year 2 the Flyers pull up out of the Sea and swing round inside a Cloud (the Turn-around, moved here), then climb straight up facing her through Year 3 while the camera in front of them rises with them (the Face-on climb). Year 3's pictures are Fly-bys in the open Sky. The climb ends under the Letter, where the story finishes as before. See ADR 0002.

- **Turn-around moved:** the Year 2 to Year 3 Cloud pass becomes the pull-up and swing. The Flyers come out facing the camera, which has moved from behind them to in front of them (the camera rig from ticket 07 gets its face-on mode). The Turn-around that used to happen just before the Letter is removed from the route and the timeline.
- **Face-on climb:** Year 3 is a straight climb up with a slight sway. The Sea falls away below at the start; Clouds and pictures stream down past. The Flyers stay at the same place on screen.
- **Fly-by in the Sky:** the same rule as Year 2, with no water and no reflection: pictures hang in the open Sky on alternating sides, lost in haze while far away, clear as the Flyers pass, haze after; 0.8 screens each; Month labels write on.
- **Sky:** sunset deepens into rose night during the climb, and the stars arrive as they rise, fully there by the Letter.
- **Ending:** the Flyers slow to a stop face on below the Letter card, as the Turn-around used to leave them. The Letter section (card, greeting, body, Closing line, hold) is unchanged. Year 3's title and date write during the Turn-around.
- **Cleanup and length:** remove route and timeline pieces that only the old Turn-around used. Check the whole story against the budget with `?debug`: about 54 screens, about 5.8 minutes at the relaxed pace (0.7 Intro, 8.0 titles, 3.6 How we met, 14.4 Year 1, 9.6 Year 2, 9.6 Year 3, about 7.8 Letter).
- **Real iPhone:** the Sea, the moving camera and 36 pictures all need the real-device pass that ticket 05 left open (frame rate and memory with at most 4 photo textures held).

**Blocked by:** 07: Year 2 over the Sea.

**Status:** not started

**Needs from the Creator:** nothing new. At the end, one real picture for each of the 36 Months and 3 Captions for How we met, as listed in ticket 06.

- [ ] At the end of Year 2 the Flyers pull up out of the Sea and swing round inside a Cloud, and come out facing the camera with no visible jump; scrolling back reverses it.
- [ ] Year 3 is a straight climb with the camera in front; the Sea falls away; Clouds and pictures stream down.
- [ ] Each Year 3 picture follows the same haze rule as Year 2, with no reflection, and never covers the Flyers.
- [ ] The stars arrive during the climb and the Sky is deep rose at the Letter.
- [ ] The Flyers stop face on below the Letter card, and the Letter and Closing line work exactly as before.
- [ ] There is no Turn-around just before the Letter any more, and no dead code from it remains.
- [ ] `?debug` shows about 54 screens and about 5.8 minutes.
- [ ] Phone (portrait) and laptop both frame the climb well, and the plain list and reduced motion still carry the whole story.
- [ ] Tests cover the new seams: the face-on camera mode, the Turn-around placement, the Year 3 route, and the Sky mood by Chapter.
