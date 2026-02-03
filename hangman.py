import random
words = ["python", "apple", "coding", "hangman", "program"]
word = random.choice(words)
guessed_letters = []
wrong_guesses = 0
max_wrong = 6

print(" WELCOME TO HANGMAN GAME")
print("You have 6 incorrect guesses.\n")
while wrong_guesses < max_wrong:
    display = ""
    for letter in word:
        if letter in guessed_letters:
            display += letter
        else:
            display += "_"

    print("Word:", display)
    print("Wrong guesses left:", max_wrong - wrong_guesses)
    if display == word:
        print("\nCONGRATULATIONS! YOU WON ")
        break

    guess = input("Guess a letter: ").lower()

    if guess in guessed_letters:
        print("Letter already guessed.\n")
        continue

    guessed_letters.append(guess)

    if guess not in word:
        wrong_guesses += 1
        print(" Wrong guess!\n")
    else:
        print("Correct guess!\n")
if wrong_guesses == max_wrong:
    print(" GAME OVER")
    print("The correct word was:", word)
