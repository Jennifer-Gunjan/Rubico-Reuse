# Demo script and acceptance checklist

## 10-minute demo (two browsers or a private window; load demo data first with supabase/seed.sql)

1. **Sign in** with a @rubicotech.in address. Show that a Gmail address is refused. (1 min)
2. **Browse.** Search "desk". Filter by Dehradun and by Lend. Open an item with photos. (2 min)
3. **Post** an item as Giver: choose Sell, show the price and Negotiable. Try typing "medicines" in the title and show it is refused. (2 min)
4. **Request** the item from the second browser with a message. Show the giver's bell count go up. (1 min)
5. **Accept** as Giver. Both sides now see each other's email and Teams handle; nobody else does. (2 min)
6. **Hand over:** mark Given and show it leaves search. Show "Deal fell through" on another item and that it returns to Available. (1 min)
7. **Wanted board:** post a wanted item, answer "I have this" from the other account. (1 min)

Say out loud: contact details are protected by the database, two simultaneous accepts cannot both win (tested on a real database 25 times), and there are about 250 automated tests.

## Acceptance checklist (tick each with a colleague)

- [ ] Sign in works with @rubicotech.com and @rubicotech.in; any other address is refused
- [ ] Profile saves name, city and Teams handle; posting needs it
- [ ] Post one item of each type (Free, Exchange, Sell, Lend) with 1 to 4 photos
- [ ] Banned words (medicines, weapons) are refused in listings and wanted posts
- [ ] Search, category, city and type filters give the expected items
- [ ] Request, withdraw, reject, accept all work and the right person is notified
- [ ] Contact details appear only after Accept, only for the two people
- [ ] Given, Lent, Returned, relist, Deal fell through, Close and Relist work
- [ ] Wanted board: post, "I have this", mark fulfilled
- [ ] Report this listing reaches the product owner
- [ ] Works in Chrome on Mac, Windows, Linux and on a phone
- [ ] Notification emails arrive (needs the sending domain; check spam)
