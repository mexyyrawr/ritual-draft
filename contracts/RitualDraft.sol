// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrecompileConsumer.sol";

/// @title RitualDraft — AI-powered content writer for Ritual Chain
contract RitualDraft is PrecompileConsumer {
    uint256 public nextDraftId;
    mapping(uint256 => address) public draftAuthor;
    mapping(uint256 => bool) public draftPending;

    event DraftRequested(uint256 indexed id, address indexed author);

    /// @notice Request draft generation. LLM processes async — result via spcCalls.
    function generateDraft(bytes calldata llmInput) external payable {
        // Auto-deposit to RitualWallet to extend lock
        if (msg.value > 0) {
            (bool ok,) = RITUAL_WALLET.call{value: msg.value}(
                abi.encodeWithSignature("deposit(uint256)", 100000)
            );
            require(ok, "Deposit failed");
        }

        uint256 id = nextDraftId;
        nextDraftId = id + 1;
        draftAuthor[id] = msg.sender;
        draftPending[id] = true;

        // Call precompile (queues async request)
        (bool success,) = LLM_INFERENCE_PRECOMPILE.call(llmInput);
        require(success, "Precompile call failed");

        emit DraftRequested(id, msg.sender);
    }

    function getDraftAuthor(uint256 id) external view returns (address) {
        return draftAuthor[id];
    }

    function isDraftPending(uint256 id) external view returns (bool) {
        return draftPending[id];
    }

    /// @notice Auto-deposit when RITUAL is sent to contract
    receive() external override payable {
        (bool ok,) = RITUAL_WALLET.call{value: msg.value}(
            abi.encodeWithSignature("deposit(uint256)", 100000)
        );
        require(ok, "Auto-deposit failed");
    }
}
