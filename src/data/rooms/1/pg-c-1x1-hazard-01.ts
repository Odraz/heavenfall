import { expandRoom } from '../notation';
export const trials = expandRoom(`
id        pg-c-1x1-hazard-01
name      The Gridiron
kind      combat
shape     1x1
focus     hazard
bands     1 3
weight    1
grid
 0 ......::........ x..x........x..x
 1 ......::........ ..............o.
 2 ......::........ .o..............
 3 ..........#..... ....!...........
 4 ~~~~~~..~~~~~~~~ ................
 5 ................ ................
 6 :::..........::: .......RRo......
 7 :::#........#::: .......RR.......
 8 ...#........#... ................
 9 ................ .......o.....+..
10 ................ ................
11 ~~~~~~..~~~~~~~~ ................
12 .....#.......... ..........!.....
13 ......::........ ..............o.
14 ......::........ .o..............
15 ......::........ x..x........x..x
obstacles
  lure   0,4 15,4 north fire line (2 m) with a 4 m bridge in front of the north door
  lure   0,11 15,11 south fire line with its bridge
  lure   10,3 10,3 post at the north line: kite round it and the train crosses the fire
  lure   5,12 5,12 post at the south line
  kite   3,7 3,8 west pillar in the middle band
  kite   12,7 12,8 east pillar in the middle band
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 1
  3 0.40 blessed 1
`);
