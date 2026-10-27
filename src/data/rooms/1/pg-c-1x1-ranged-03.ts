/** The Rood Screen (rooms.md, `pg-c-1x1-ranged-03`): the `room` block copied verbatim. */
import { expandRoom } from '../notation';

export default expandRoom(`
id        pg-c-1x1-ranged-03
name      The Rood Screen
kind      combat
shape     1x1
focus     ranged
bands     2 3
weight    1
grid
 0 ......::........ x..............x
 1 .222..::........ ..o.............
 2 .222..::........ ................
 3 .222.......##... ................
 4 ..^............. o......+.......o
 5 ..^............. ................
 6 :::.....#....::: ................
 7 :::.....#....::: ................
 8 ................ .....c....c!....
 9 .###..####..###. ................
10 ................ ....!...........
11 ................ x......RR......x
12 ................ .......RR....o..
13 ......::........ ..o.............
14 ......::........ .........o......
15 ......::........ x..x.......x...x
obstacles
  cover  1,9 3,9 west screen wall
  cover  6,9 9,9 middle screen wall: the choir sees the nave only through the gaps
  cover  12,9 14,9 east screen wall
  choke  1,9 14,9 the screen: two 4 m gaps and two 2 m slots funnel the choir side into the nave
  cover  11,3 12,3 nave pillar
  cover  8,6 8,7 nave pillar: hides the north door from the east gap
  high   1,1 3,5 pulpit (+2 m) and its stair: watch both gaps from above
props     loot 0.85 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.7 chorister 0.3
  3 0.40 blessed 0.7 chorister 0.3
`);
