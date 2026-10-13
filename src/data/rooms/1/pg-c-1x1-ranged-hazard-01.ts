import { expandRoom } from '../notation';
export default expandRoom(`
id        pg-c-1x1-ranged-hazard-01
name      The Burning Aisle
kind      combat
shape     1x1
focus     ranged
secondary hazard
bands     2 3
weight    1
grid
 0 ......::........ x..............x
 1 ..##..::....##.. ................
 2 ......::........ .....o...o....o.
 3 ................ o..............x
 4 ....##....##.... .......RR.......
 5 ....##....##.... .......RR.......
 6 :::..........::: ................
 7 :::..........::: ................
 8 ................ .....!.....c....
 9 ~~~..~~~~~~..~~~ ................
10 ~~~..~~~~~~..~~~ ................
11 ................ ....c.......!...
12 ...#.......22222 x.......+...x...
13 ...#..::.>>22222 ................
14 ......::.>>22222 .o..............
15 ......::...22222 x..x.........o.x
obstacles
  lure   0,9 2,10 west fire channel (4 m): Blessed from the south burn crossing it
  lure   5,9 10,10 central fire channel between the two bridges
  lure   13,9 15,10 east fire channel
  choke  3,8 4,11 west bridge (4 m): the dry way across, a lamp at its mouth
  choke  11,8 12,11 east bridge (4 m)
  high   9,12 15,15 south-east choir terrace (+2 m) and its stair: the Choristers fire across the fire
  cover  2,1 3,1 north-west pillar
  cover  12,1 13,1 north-east pillar
  cover  4,4 5,5 pier (4 m): hides the reward spot side from the west bridge
  cover  10,4 11,5 pier (4 m): hides it from the terrace
  cover  3,12 3,13 south-west pillar: cover for crossing the west bridge
props     loot 0.85 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.7 chorister 0.3
  3 0.40 blessed 0.7 chorister 0.3
`);
