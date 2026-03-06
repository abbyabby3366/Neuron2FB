# Basic functions from before
create_deck <- function() {
  regular_cards <- rep(1:9, each=4)
  tens <- rep(10, 4)
  return(c(regular_cards, tens))
}

get_end_digit <- function(cards) {
  sum_val <- sum(cards)
  return(sum_val %% 10)
}

is_three_tens <- function(cards) {
  return(all(cards == 10))
}

# Calculate payout between banker and player
calculate_payout <- function(banker_cards, player_cards) {
  # Check for three tens first
  if (is_three_tens(banker_cards) && !is_three_tens(player_cards)) return(10)
  if (!is_three_tens(banker_cards) && is_three_tens(player_cards)) return(-10)
  if (is_three_tens(banker_cards) && is_three_tens(player_cards)) return(0)
  
  # Get end digits
  banker_digit <- get_end_digit(banker_cards)
  player_digit <- get_end_digit(player_cards)
  
  # Special case: both 0, banker wins
  if (banker_digit == 0 && player_digit == 0) return(1)
  
  # Draw condition
  if (banker_digit == player_digit) return(0)
  
  # Determine winner and multiplier
  if (banker_digit > player_digit) {
    multiplier <- switch(as.character(banker_digit),
                         "9" = 5,
                         "8" = 3,
                         "7" = 2,
                         1)
    return(multiplier)
  } else {
    multiplier <- switch(as.character(player_digit),
                         "9" = 5,
                         "8" = 3,
                         "7" = 2,
                         1)
    return(-multiplier)
  }
}

# Run simulation
n_simulations <- 100000
n_players <- 5

# Initialize bankrolls
banker_bankroll <- 0
player_bankrolls <- rep(0, n_players)

# To store bankrolls over time
banker_bankroll_history <- numeric(n_simulations)
player_bankrolls_history <- matrix(0, nrow=n_simulations, ncol=n_players)

for (sim in 1:n_simulations) {
  # Create and shuffle deck for each round
  deck <- sample(create_deck())
  
  # Deal banker's cards
  banker_cards <- deck[1:3]
  current_deck <- deck[-(1:3)]
  
  # Deal to each player and calculate results
  for (player in 1:n_players) {
    # Deal player's cards
    start_idx <- ((player-1) * 3) + 1
    player_cards <- current_deck[start_idx:(start_idx+2)]
    payout <- calculate_payout(banker_cards, player_cards)
    
    # Update bankrolls
    banker_bankroll <- banker_bankroll + payout
    player_bankrolls[player] <- player_bankrolls[player] - payout
  }
  
  # Record bankrolls for this round
  banker_bankroll_history[sim] <- banker_bankroll
  player_bankrolls_history[sim,] <- player_bankrolls
}

# Plot bankrolls over time
plot(1:n_simulations, banker_bankroll_history, type="l", col="red", ylim=range(c(banker_bankroll_history, player_bankrolls_history)),
     main="Bankrolls Over Time", xlab="Round", ylab="Bankroll")
for (player in 1:n_players) {
  lines(1:n_simulations, player_bankrolls_history[,player], col=player+1)
}
legend("topright", legend=c("Banker", paste("Player", 1:n_players)), 
       col=c("red", 2:(n_players+1)), lty=1, cex=0.8)