import express from "express";
import fetch from "node-fetch";
import cors from "cors";

// Initialize the Express application
const app = express();

// Set the port to an environment variable or default to 3000
const PORT = process.env.PORT || 3000;

// cors middleware to allow cross-origin requests
// This is necessary for the frontend to communicate with the backend
app.use(cors());

// Route 1: List of first 150 Pokémon (basic info)
app.get("/api/pokemon", async (req, res) => {
  // try-catch block to handle errors during the fetch operation
  try {
    // Fetch the first 150 Pokémon from the PokeAPI
    // This endpoint returns basic information about each Pokémon
    const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=150");

    // Check if the response is ok (status code 200-299)
    const data = await response.json();

    // Map through the results to fetch detailed information for each Pokémon
    const detailedPromises = data.results.map(async pokemon => {
      // For each Pokémon, fetch its detailed information
      const res = await fetch(pokemon.url);

      // await for the response to be converted to JSON
      const details = await res.json();
      // Return an object containing the Pokémon's id, name, sprite, and types
      return {
        id: details.id,
        name: details.name,
        sprite: details.sprites.front_default,
        types: details.types.map(t => t.type.name)
      };
    });

    // Wait for all detailed Pokémon data to be fetched
    // This ensures that the response contains detailed information for each Pokémon
    // The Promise.all method is used to handle multiple asynchronous operations
    // It waits for all promises in the array to resolve and returns an array of results
    // If any promise rejects, it will throw an error
    const pokemons = await Promise.all(detailedPromises);
    res.json(pokemons);
  } catch (error) {
    console.error("Error fetching Pokémon list:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Route 2: Detailed info for a single Pokémon
app.get("/api/pokemon/:name", async (req, res) => {
  const name = req.params.name.toLowerCase();

  function parseEvolutionChain(chain) {
    const evoArray = [];
    function traverse(chainNode) {
      evoArray.push(chainNode.species.name);
      if (chainNode.evolves_to.length > 0) {
        chainNode.evolves_to.forEach(evolve => traverse(evolve));
      }
    }
    traverse(chain);
    return evoArray;
  }

  try {
    const pokeResponse = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${name}`
    );
    if (!pokeResponse.ok) {
      return res.status(404).json({ error: "Pokémon not found" });
    }
    const pokeData = await pokeResponse.json();

    const speciesResponse = await fetch(pokeData.species.url);
    if (!speciesResponse.ok) {
      return res.status(404).json({ error: "Species data not found" });
    }
    const speciesData = await speciesResponse.json();

    const evoChainResponse = await fetch(speciesData.evolution_chain.url);
    if (!evoChainResponse.ok) {
      return res.status(404).json({ error: "Evolution chain data not found" });
    }
    const evoChainData = await evoChainResponse.json();

    const evolutionChain = parseEvolutionChain(evoChainData.chain);

    const result = {
      name: pokeData.name,
      height: pokeData.height / 10,
      weight: pokeData.weight / 10,
      habitat: speciesData.habitat ? speciesData.habitat.name : "unknown",
      evolutionChain,
      types: pokeData.types.map(t => t.type.name),
      abilities: pokeData.abilities.map(a => ({
        name: a.ability.name,
        is_hidden: a.is_hidden
      })),
      sprites: pokeData.sprites.front_default
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching Pokémon details:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
