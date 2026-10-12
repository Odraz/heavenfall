/** The Choir Loft (rooms.md, `pg-c-1x1-ranged-01`): the `room` block copied verbatim. */
import { expandRoom } from '../notation';

export default expandRoom(`
id        pg-c-1x1-ranged-01
name      The Choir Loft
kind      combat
shape     1x1
focus     ranged
bands     1 2
weight    1
grid
 0 22222.::...22222 x..x........x..x
 1 22222.::...22222 ..o..........o..
 2 22222.::...22222 ................
 3 22222......22222 x...c......c...x
 4 .^^..........^^. ....!......!....
 5 .^^..........^^. ................
 6 :::..........::: ................
 7 :::.##....##.::: .......+........
 8 ....##....##.... ................
 9 ................ o......RR......o
10 ................ ...u...RR...u...
11 ...#........#... ................
12 ...#........#... ................
13 ......::........ ................
14 ......::........ .....o....o.....
15 ......::........ x..............x
obstacles
  high   0,0 4,5 west loft (+2 m) and its stair: Choristers nest here; storm it or deny it
  high   11,0 15,5 east loft (+2 m) and its stair
  cover  4,7 5,8 nave pillar: hides the middle from the west loft
  cover  10,7 11,8 nave pillar: hides the middle from the east loft
  cover  3,11 3,12 south-west pillar: cover for the approach to the west stair
  cover  12,11 12,12 south-east pillar
props     loot 0.85 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.7 chorister 0.3
  3 0.40 blessed 0.7 chorister 0.3
`);
