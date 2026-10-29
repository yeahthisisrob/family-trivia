# Changelog

## [0.2.1](https://github.com/yeahthisisrob/family-trivia/compare/v0.2.0...v0.2.1) (2026-10-29)


### Bug Fixes

* **ci:** leave the release-please manifest out of Biome ([#135](https://github.com/yeahthisisrob/family-trivia/issues/135)) ([4388a47](https://github.com/yeahthisisrob/family-trivia/commit/4388a470a122738d870b3e2ed6ec3fc9e1d0062e))

## [0.2.0](https://github.com/yeahthisisrob/family-trivia/compare/v0.1.0...v0.2.0) (2026-10-26)


### ⚠ BREAKING CHANGES

* use `just install` and `just dev`; npm scripts and the cdk/ paths are gone.

### Features

* **admin:** family editor for people, connections, memorials and households ([2fcb7b4](https://github.com/yeahthisisrob/family-trivia/commit/2fcb7b4a3a8369f1e43cb5065c4c458dac41abd3))
* **admin:** write the family's story from Admin › Family ([#27](https://github.com/yeahthisisrob/family-trivia/issues/27)) ([8e5bf30](https://github.com/yeahthisisrob/family-trivia/commit/8e5bf30729a076deaadfb606b8599d1f38048edc))
* **ai:** one frame per kind of circle, on every prompt ([#76](https://github.com/yeahthisisrob/family-trivia/issues/76)) ([c9f6a9b](https://github.com/yeahthisisrob/family-trivia/commit/c9f6a9bd0275c0de4945cd4aa8143fd5b56e516f))
* **archive:** download the family archive from the Family tab ([09b8623](https://github.com/yeahthisisrob/family-trivia/commit/09b862391c73b8b422033b648d2aacb87a40f49b))
* **archive:** download the family archive, one folder per person ([d8c2fde](https://github.com/yeahthisisrob/family-trivia/commit/d8c2fded117d744ed99c6cf0e76d2bb3ed01a6d6))
* **avatars:** better-looking styles, friendly faces only, skin tone as a second step ([#83](https://github.com/yeahthisisrob/family-trivia/issues/83)) ([529c16f](https://github.com/yeahthisisrob/family-trivia/commit/529c16fd4fbdcb80df2f5eb0f8232d8e323d30cd))
* **avatars:** pick a picture from one shared library, shown everywhere ([#77](https://github.com/yeahthisisrob/family-trivia/issues/77)) ([24abbf7](https://github.com/yeahthisisrob/family-trivia/commit/24abbf7635ebe9012f99abeb55d8601c07c83de1))
* **backups:** make a checked backup from Settings; nightly is a setting, off ([#30](https://github.com/yeahthisisrob/family-trivia/issues/30)) ([6e6fe1b](https://github.com/yeahthisisrob/family-trivia/commit/6e6fe1b1fd2978104616f86990bc37ba0dd5f903))
* **books:** a wraparound cover for every book, ready for a press ([#49](https://github.com/yeahthisisrob/family-trivia/issues/49)) ([12e1730](https://github.com/yeahthisisrob/family-trivia/commit/12e17300c33216cdf3c54ec6c8e5bfc990ae77ec))
* **books:** anyone's words as a printed book, on one shared press ([#45](https://github.com/yeahthisisrob/family-trivia/issues/45)) ([cd970f7](https://github.com/yeahthisisrob/family-trivia/commit/cd970f7f6de126175ee76857cd1bd6225653909d))
* **books:** fitted books, chapters that share a page, two-page spreads ([#60](https://github.com/yeahthisisrob/family-trivia/issues/60)) ([795eece](https://github.com/yeahthisisrob/family-trivia/commit/795eecedd18503f7943cd68865dc2d04c9b6f9af))
* **books:** page images are just the words; names stay with answers ([#59](https://github.com/yeahthisisrob/family-trivia/issues/59)) ([b31e8f0](https://github.com/yeahthisisrob/family-trivia/commit/b31e8f04be86d6faf74549252cb7ca7d959138da))
* **books:** read a book in the app, and share its pages as images ([#58](https://github.com/yeahthisisrob/family-trivia/issues/58)) ([79f700d](https://github.com/yeahthisisrob/family-trivia/commit/79f700df73f899f8990c8487337323dd973d2491))
* **circles:** one sign-in, many circles, every key scoped to its circle ([#69](https://github.com/yeahthisisrob/family-trivia/issues/69)) ([57a6771](https://github.com/yeahthisisrob/family-trivia/commit/57a6771dd23912a615a104657c5bf33bac0eee73))
* **design:** light and dark mode, and a night surface for graphs ([529cb58](https://github.com/yeahthisisrob/family-trivia/commit/529cb58d5f99a00e4c3b2d0828ace26028e92f24))
* **design:** themes as data, an Appearance menu, and color tokens everywhere ([c656fdf](https://github.com/yeahthisisrob/family-trivia/commit/c656fdf0af864d3e7277a3a64f72a18ce70906d9))
* **family:** a Remembering page for the people the family has lost ([#38](https://github.com/yeahthisisrob/family-trivia/issues/38)) ([af44dd8](https://github.com/yeahthisisrob/family-trivia/commit/af44dd8d5392f4dc63c2a777134dafb08164804e))
* **family:** a story-first Family tab, and the leaderboard inside Trivia ([#26](https://github.com/yeahthisisrob/family-trivia/issues/26)) ([3228244](https://github.com/yeahthisisrob/family-trivia/commit/322824463a72e0b546ed68c4a3e01afdffcda8ff))
* **family:** look back on a season, and save it as a book ([#40](https://github.com/yeahthisisrob/family-trivia/issues/40)) ([000039e](https://github.com/yeahthisisrob/family-trivia/commit/000039e6e5ad05ddbaf837e9bf7fce7b6797855b))
* **family:** people and relationships that change over time ([dab545c](https://github.com/yeahthisisrob/family-trivia/commit/dab545c7a03a349e8ee67a754798caadb8deb554))
* **family:** the family's knowledge index, personas and numbers ([#31](https://github.com/yeahthisisrob/family-trivia/issues/31)) ([3b51fc7](https://github.com/yeahthisisrob/family-trivia/commit/3b51fc77e724c2250454d4f77dd2dcb69a042ee8))
* **family:** what the family said about someone, in their story and book ([#56](https://github.com/yeahthisisrob/family-trivia/issues/56)) ([5705d2c](https://github.com/yeahthisisrob/family-trivia/commit/5705d2c5974b6be1d21d5f354703a3c0f21807f7))
* **graph:** find who answered alike, with the evidence ([c953b09](https://github.com/yeahthisisrob/family-trivia/commit/c953b09697fc1856622e0de86564de2ead7c2c82))
* **graph:** Our map, what the family talks about as a night sky of territories ([#46](https://github.com/yeahthisisrob/family-trivia/issues/46)) ([a2a1b08](https://github.com/yeahthisisrob/family-trivia/commit/a2a1b082513d09b6481fe4a6ab25ab4a932e273c))
* **graph:** the family as a night sky, connected by ties and shared answers ([f65c52e](https://github.com/yeahthisisrob/family-trivia/commit/f65c52e950baf5d4965a570336f84f0d72a21aa2))
* **home:** a memory a day from the family's pages ([#51](https://github.com/yeahthisisrob/family-trivia/issues/51)) ([f15e754](https://github.com/yeahthisisrob/family-trivia/commit/f15e754919866d6166e8663aab911fa66fc4188c))
* **home:** Home in the order you'd use it, with less to scroll ([#96](https://github.com/yeahthisisrob/family-trivia/issues/96)) ([800c2f4](https://github.com/yeahthisisrob/family-trivia/commit/800c2f4bcc0978f5fd31d30821ef2f0dfa45661e))
* **home:** welcome back, with what's new since you were last here ([#95](https://github.com/yeahthisisrob/family-trivia/issues/95)) ([dd35a5b](https://github.com/yeahthisisrob/family-trivia/commit/dd35a5ba7fe980bed0bd10d7718d2030f3c3a5fc))
* **invites:** start circles and bring people in with a link ([#71](https://github.com/yeahthisisrob/family-trivia/issues/71)) ([a1dc616](https://github.com/yeahthisisrob/family-trivia/commit/a1dc616ebac9f67422edadff1d8229162245f0eb))
* **look-back:** a season as a print-ready book, written once and kept ([#43](https://github.com/yeahthisisrob/family-trivia/issues/43)) ([5863761](https://github.com/yeahthisisrob/family-trivia/commit/586376173aab4326193f32f244d05d06483b3cdc))
* **look-back:** a written book reads like a story, chapters by theme ([#47](https://github.com/yeahthisisrob/family-trivia/issues/47)) ([d5a92ed](https://github.com/yeahthisisrob/family-trivia/commit/d5a92ed6dfcdae700ba6591b1f8e518559bc59a6))
* **pace:** a season can go daily or weekly; friends circles start weekly ([#91](https://github.com/yeahthisisrob/family-trivia/issues/91)) ([a817c69](https://github.com/yeahthisisrob/family-trivia/commit/a817c6983c13f72df805f5a4cdf05b763be8a6aa))
* **pictures:** one made for you by AI, or an animal; the tab is Us ([#84](https://github.com/yeahthisisrob/family-trivia/issues/84)) ([80fbcf7](https://github.com/yeahthisisrob/family-trivia/commit/80fbcf74b31a9db20d57922b7d96933f84cdd739))
* **plans:** after the day, the people who were in it say how it went ([#94](https://github.com/yeahthisisrob/family-trivia/issues/94)) ([72019dc](https://github.com/yeahthisisrob/family-trivia/commit/72019dc095b111dbe4a739bafea85ed614ef3b0b))
* **plans:** drop in what you're doing, and see what's on for everyone ([#80](https://github.com/yeahthisisrob/family-trivia/issues/80)) ([79ced86](https://github.com/yeahthisisrob/family-trivia/commit/79ced8606e68327ecf369d57324e58761434d0a9))
* **play:** nothing waits on anyone else, nothing expires, no streaks ([#87](https://github.com/yeahthisisrob/family-trivia/issues/87)) ([e92ab3c](https://github.com/yeahthisisrob/family-trivia/commit/e92ab3c85f887ea977894daa7a710b001c1fb077))
* **profile:** fill in your story, flash-card style ([#29](https://github.com/yeahthisisrob/family-trivia/issues/29)) ([e4fd3e3](https://github.com/yeahthisisrob/family-trivia/commit/e4fd3e3c9321887d8c6280136b9c06f38f4504ad))
* **profile:** one profile for everyone, told as a story ([#39](https://github.com/yeahthisisrob/family-trivia/issues/39)) ([83a5854](https://github.com/yeahthisisrob/family-trivia/commit/83a5854a47f0bf3250e511c2dccbcfe433d5af7d))
* **profile:** what you love, kept and noted, and an index that fills itself ([#79](https://github.com/yeahthisisrob/family-trivia/issues/79)) ([b824be6](https://github.com/yeahthisisrob/family-trivia/commit/b824be6e4ab7a98a33bd0d321ee2622f04652130))
* **questions:** starter questions and a trivia category for each kind of circle ([#82](https://github.com/yeahthisisrob/family-trivia/issues/82)) ([abc8890](https://github.com/yeahthisisrob/family-trivia/commit/abc889052c02183c226d648f82f522db3613beb0))
* reactions on answers and facts; people who never joined stay out of view ([#28](https://github.com/yeahthisisrob/family-trivia/issues/28)) ([821250c](https://github.com/yeahthisisrob/family-trivia/commit/821250c22a7a460d2f1a6c07dae34309a7d29be3))
* **remembering:** memory links, so anyone who knew them can add a memory ([#81](https://github.com/yeahthisisrob/family-trivia/issues/81)) ([72c44ee](https://github.com/yeahthisisrob/family-trivia/commit/72c44ee53e03a3b60074a94670c0b36f99eb0ec7))
* **seasons:** a facts-only season — the daily questions, no trivia ([#35](https://github.com/yeahthisisrob/family-trivia/issues/35)) ([36c578b](https://github.com/yeahthisisrob/family-trivia/commit/36c578b9f5334544b8d1092353924ff484d93c64))
* **seasons:** letters for a season's start and end, shown once ([cd76352](https://github.com/yeahthisisrob/family-trivia/commit/cd76352239ca25b72a874d3b29f5daa5c1825c58))
* **seasons:** trivia about the family itself — general, family, or both ([#33](https://github.com/yeahthisisrob/family-trivia/issues/33)) ([5522ddf](https://github.com/yeahthisisrob/family-trivia/commit/5522ddf7e5e59432c6780a2e46935944b4e98f20))
* **settings:** admin Settings with features, an AI model per task, and real costs ([80c32a6](https://github.com/yeahthisisrob/family-trivia/commit/80c32a67295cfc5914c22631e71a5ec4952c091a))
* **setup:** the first sign-in starts the first circle; the wizard is gone ([#86](https://github.com/yeahthisisrob/family-trivia/issues/86)) ([20220a1](https://github.com/yeahthisisrob/family-trivia/commit/20220a163d90b6fe53cd191ca6d824ee7b373d10))
* **teams:** a season can be played in teams, made while playing ([#90](https://github.com/yeahthisisrob/family-trivia/issues/90)) ([ae10ee3](https://github.com/yeahthisisrob/family-trivia/commit/ae10ee3723e22e45aeca6ca3aef5acaa65d1b992))
* **threads:** the circle's connections come from one tap a day ([#75](https://github.com/yeahthisisrob/family-trivia/issues/75)) ([9cdf94b](https://github.com/yeahthisisrob/family-trivia/commit/9cdf94be40c8b2b817c29ee85cdb3245b15768c4))
* **ties:** one tie registry for family and friends, and words per circle ([#73](https://github.com/yeahthisisrob/family-trivia/issues/73)) ([1f09733](https://github.com/yeahthisisrob/family-trivia/commit/1f09733da6f4460259dd056a8a1b1d6016738e38))
* **web:** Admin and Settings on server data (0035, step 4, first part) ([#121](https://github.com/yeahthisisrob/family-trivia/issues/121)) ([0ec493d](https://github.com/yeahthisisrob/family-trivia/commit/0ec493d4eb0486cf209e7b85d86378408ffd91f9))
* **web:** Home's older cards and reactions on server data (0035, step 2) ([#117](https://github.com/yeahthisisrob/family-trivia/issues/117)) ([2ac32f2](https://github.com/yeahthisisrob/family-trivia/commit/2ac32f279f9de6ecdcedf3617ec2153cbb03be1c))
* **web:** Profile and Us on server data (0035, step 3, first part) ([#119](https://github.com/yeahthisisrob/family-trivia/issues/119)) ([c7337c4](https://github.com/yeahthisisrob/family-trivia/commit/c7337c410b48b83d0c64ac2169d4cca809f71961))
* **web:** server data through TanStack Query, Home's cards first ([#115](https://github.com/yeahthisisrob/family-trivia/issues/115)) ([f7fdff6](https://github.com/yeahthisisrob/family-trivia/commit/f7fdff6982723c68adc813992d80cccd29a47ddf))
* **web:** the leaderboard, the Arcade and the Trivia tab on server data (0035, step 3) ([#120](https://github.com/yeahthisisrob/family-trivia/issues/120)) ([80137e3](https://github.com/yeahthisisrob/family-trivia/commit/80137e3496c9ce037a29a87f8d803593f8e96ec8))
* **words:** the Us tab speaks the circle's language ([#88](https://github.com/yeahthisisrob/family-trivia/issues/88)) ([cc10947](https://github.com/yeahthisisrob/family-trivia/commit/cc1094700ccfbc153d49bf641b30faa726178f5f))
* **world:** Your world, all your circles in one sky, for you alone ([#93](https://github.com/yeahthisisrob/family-trivia/issues/93)) ([7bd5a9a](https://github.com/yeahthisisrob/family-trivia/commit/7bd5a9af9a5e03e54ffa4dff1a6880d696ed0edd))


### Bug Fixes

* **ai:** move off the retired Sonnet 4 model; never cache a failed summary ([51a6dd6](https://github.com/yeahthisisrob/family-trivia/commit/51a6dd60817340668513a378e883281a2e52f674))
* **auth:** an expired session signs out once and gently; sessions last 30 days ([eb9ee66](https://github.com/yeahthisisrob/family-trivia/commit/eb9ee6661471a2089ede2aa51bc513bc75a550c8))
* **books:** books can be downloaded, and a failed request never blanks the page ([#48](https://github.com/yeahthisisrob/family-trivia/issues/48)) ([d23478a](https://github.com/yeahthisisrob/family-trivia/commit/d23478ac7132a8bcc4c2cca2a4401c0b83720c28))
* **books:** downloading all the images always gives one zip ([#61](https://github.com/yeahthisisrob/family-trivia/issues/61)) ([3e96dbb](https://github.com/yeahthisisrob/family-trivia/commit/3e96dbb4438708e3415bd7270a297452d8895ef7))
* **books:** no blank pages at the end of a book ([#55](https://github.com/yeahthisisrob/family-trivia/issues/55)) ([f729424](https://github.com/yeahthisisrob/family-trivia/commit/f7294243ea3f5a1fea7b38285e5a57e02668147a))
* **books:** no half title, copyright page or blank pages; emoji print ([#57](https://github.com/yeahthisisrob/family-trivia/issues/57)) ([1ec3df9](https://github.com/yeahthisisrob/family-trivia/commit/1ec3df9aaf2ababc22816853e92b40d3bd07cf9f))
* **circles:** a new circle is playable the moment it's made ([#74](https://github.com/yeahthisisrob/family-trivia/issues/74)) ([d77c756](https://github.com/yeahthisisrob/family-trivia/commit/d77c756cf74a9ca3feb2052675b791847406e429))
* **circles:** a new circle opens, and every circle has an Invite button ([#89](https://github.com/yeahthisisrob/family-trivia/issues/89)) ([7fddc75](https://github.com/yeahthisisrob/family-trivia/commit/7fddc75e7d556c13c3469ae5cd83add07262fb5a))
* **design:** dark mode everywhere, with an audit that keeps it that way ([e75a770](https://github.com/yeahthisisrob/family-trivia/commit/e75a7705365621774b28bf2ed2055d5bc6157088))
* **family:** faces you can tell apart, and nothing cut off ([#41](https://github.com/yeahthisisrob/family-trivia/issues/41)) ([cd820f7](https://github.com/yeahthisisrob/family-trivia/commit/cd820f74f3a60aa175421600c511a4e9488a5a06))
* **family:** remembering looks right in dark mode ([#54](https://github.com/yeahthisisrob/family-trivia/issues/54)) ([e5cd6ff](https://github.com/yeahthisisrob/family-trivia/commit/e5cd6ff9e24063c8ea6072300457259830e6f9d7))
* **family:** story first on the Family tab; read insights from newer models ([9f0ce6d](https://github.com/yeahthisisrob/family-trivia/commit/9f0ce6d5887298d6422339ad1969f5d2bf107a09))
* **family:** the numbers live in the story at the top; remembered before everyone ([#32](https://github.com/yeahthisisrob/family-trivia/issues/32)) ([5abb067](https://github.com/yeahthisisrob/family-trivia/commit/5abb0679171bfda30722c8cf130871ca2b4eeeb5))
* **graph:** Our map takes taps and drags before the family's answers are read ([#50](https://github.com/yeahthisisrob/family-trivia/issues/50)) ([31aa0aa](https://github.com/yeahthisisrob/family-trivia/commit/31aa0aa7f1708965326aedc5e5c227f096bb89bb))
* **graph:** Our map, tuned on a real family's index ([#53](https://github.com/yeahthisisrob/family-trivia/issues/53)) ([cbd0234](https://github.com/yeahthisisrob/family-trivia/commit/cbd0234d2cbe83666af2453d109acaf6e4c7f211))
* **graph:** the person panel shows again when you tap someone ([#34](https://github.com/yeahthisisrob/family-trivia/issues/34)) ([a4ac99a](https://github.com/yeahthisisrob/family-trivia/commit/a4ac99a571f53df2d3b5dc5ddc44888c281f6cbf))
* **home:** the memory a day looks like the rest of Home ([#52](https://github.com/yeahthisisrob/family-trivia/issues/52)) ([153a425](https://github.com/yeahthisisrob/family-trivia/commit/153a4259dc677576698b7505a7e5454a66697cc8))
* **infra:** the API's 403s and 404s reach the app; the circle is in the cache key ([#72](https://github.com/yeahthisisrob/family-trivia/issues/72)) ([b0d8e1e](https://github.com/yeahthisisrob/family-trivia/commit/b0d8e1ee74d439a0810b4092baba6e9fbad4bd87))
* **look-back:** give the book a minute, not ten seconds ([#44](https://github.com/yeahthisisrob/family-trivia/issues/44)) ([12280e1](https://github.com/yeahthisisrob/family-trivia/commit/12280e160c57c4726a790bbede3e7800a74a5e47))
* one failed request could blank the whole app ([#104](https://github.com/yeahthisisrob/family-trivia/issues/104)) ([a7f3db6](https://github.com/yeahthisisrob/family-trivia/commit/a7f3db656333deda58aee1b2fe088112ab72cfa0))
* reading sign-in data before a circle is chosen threw ([#102](https://github.com/yeahthisisrob/family-trivia/issues/102)) ([52d33d4](https://github.com/yeahthisisrob/family-trivia/commit/52d33d439413bfa36dbe33c72c8419902edbbf03))
* **seasons:** center the line under a letter's heading ([093cd62](https://github.com/yeahthisisrob/family-trivia/commit/093cd6293d6e1365e5410a4df1845d1d34d0d3b5))
* **security:** take identity from the verified token, never the request ([d8be3c5](https://github.com/yeahthisisrob/family-trivia/commit/d8be3c5caca6077cf4773ddfe76a61a1dd77a3e7))


### Documentation

* a lighter README, with every screen in a tour ([#128](https://github.com/yeahthisisrob/family-trivia/issues/128)) ([445c2d6](https://github.com/yeahthisisrob/family-trivia/commit/445c2d666e42eadfff548526b143c2cc33521c59))
* add decision records and update setup for the new toolchain ([899e770](https://github.com/yeahthisisrob/family-trivia/commit/899e770bdfa437757a65517f96f6598c07c88010))
* add screenshots to README ([#1](https://github.com/yeahthisisrob/family-trivia/issues/1)) ([a99468d](https://github.com/yeahthisisrob/family-trivia/commit/a99468d7fef1a9f2c67a835ece1f1730703cb186))
* **decisions:** circles, play as time allows, when everyone's free, your world ([#65](https://github.com/yeahthisisrob/family-trivia/issues/65)) ([8755f50](https://github.com/yeahthisisrob/family-trivia/commit/8755f504f9fc29b5111f018b83b7aee987cad4fd))
* **decisions:** no reminders outside the app ([#97](https://github.com/yeahthisisrob/family-trivia/issues/97)) ([3a1ab2c](https://github.com/yeahthisisrob/family-trivia/commit/3a1ab2c6e09df811f56c098cdfb6622b39afb9df))
* document admin bootstrap, family onboarding, and justfile ([#2](https://github.com/yeahthisisrob/family-trivia/issues/2)) ([58ee63a](https://github.com/yeahthisisrob/family-trivia/commit/58ee63aa355dd5a4244323e35fffbb88a9e22788))
* drop fleuron from dedication block ([6b2e610](https://github.com/yeahthisisrob/family-trivia/commit/6b2e610fb268f0b5568d0b16cf27766f91ee9ab9))
* drop the unused comments screenshot from the capture list ([6acd3cf](https://github.com/yeahthisisrob/family-trivia/commit/6acd3cf706a1382776dbc99779fbfd99f3e76001))
* README memorial and story ([9265707](https://github.com/yeahthisisrob/family-trivia/commit/9265707f79e18876fdf0b1eac348463e5c0495dd))
* **readme:** every feature pictured from its story, and a check that keeps the pictures current ([#64](https://github.com/yeahthisisrob/family-trivia/issues/64)) ([e7e69d3](https://github.com/yeahthisisrob/family-trivia/commit/e7e69d32799a076417ac021478f812711d1a06e9))
* **readme:** family, friends, or both, pictured from the header ([#70](https://github.com/yeahthisisrob/family-trivia/issues/70)) ([245d3c9](https://github.com/yeahthisisrob/family-trivia/commit/245d3c96c29f88a6d2df8f1e9a2631859faaad68))
* security policy, code owners, and how changes land on main ([#63](https://github.com/yeahthisisrob/family-trivia/issues/63)) ([1b083a1](https://github.com/yeahthisisrob/family-trivia/commit/1b083a10b4dcc2a385a43a75a88016f5f7271a2d))


### Code Refactoring

* **celebrations:** a celebrations slice, and every birthday read the same way ([#42](https://github.com/yeahthisisrob/family-trivia/issues/42)) ([ee47e1f](https://github.com/yeahthisisrob/family-trivia/commit/ee47e1f9bb0ba20968e68a1d418b30a3a8a8d26a))
* **comments:** a comments slice, front and back ([#37](https://github.com/yeahthisisrob/family-trivia/issues/37)) ([bb916e7](https://github.com/yeahthisisrob/family-trivia/commit/bb916e7a86573649545b94039f047cc43c4267fa))
* **design:** game boards use named game palettes ([99129ae](https://github.com/yeahthisisrob/family-trivia/commit/99129aef4daa62506d38559df0320507952c0b28))
* **design:** game boards use named game palettes; raw colors are now an error ([5909cb4](https://github.com/yeahthisisrob/family-trivia/commit/5909cb4c74dd04a4acad5c887d21655bf3a1beb9))
* **design:** leaderboard, profile, timeline, admin and shell use theme colors ([3f19ff7](https://github.com/yeahthisisrob/family-trivia/commit/3f19ff787a583c8957180c0358f255fa2b761373))
* **design:** trivia, feud, dates, photos and letters use theme colors ([5c37822](https://github.com/yeahthisisrob/family-trivia/commit/5c37822873db40636e16a61a9f0c05752f6428d7))


### Build System

* modernize toolchain with mise, pnpm workspace, Biome, Vitest and knip ([f71b22f](https://github.com/yeahthisisrob/family-trivia/commit/f71b22f429c6235cc9c415ad1d9a4351576e2686))
