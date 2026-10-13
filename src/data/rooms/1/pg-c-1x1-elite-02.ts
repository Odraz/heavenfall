import { expandRoom } from '../notation';
export default expandRoom(`
id        pg-c-1x1-elite-02
name      The Fountain Court
kind      combat
shape     1x1
focus     elite
bands     1 3
weight    1
grid
 0 ......::........ o..x.......o.x..
 1 ......::........ ................
 2 ......::........ ................
 3 ...#........#... x..............x
 4 ................ ..........!.....
 5 ................ .....o..........
 6 :::...BBBB...::: ......a...RR....
 7 :::...BBBB...::: .......f..RR....
 8 ......BBBB...... .............+..
 9 ......BBBB...... .........a......
10 ................ ..........o.....
11 ................ .....!..........
12 ...#........#... x..............x
13 ......::........ ................
14 ......::........ ................
15 ......::........ ..x.o.......x..o
obstacles
  kite   6,6 9,9 the fountain (8 m, 1.5 m tall): a tight loop you can see over; the Dominion's mace shows above it
  kite   3,3 3,3 corner pillar: a wide loop
  kite   12,3 12,3 corner pillar
  kite   3,12 3,12 corner pillar
  kite   12,12 12,12 corner pillar
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 1 elites 1
  3 0.40 blessed 1 elites 1
`);
