// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrecompileConsumer.sol";

/// @title RitualDraft — AI-powered content writer for Ritual Chain
contract RitualDraft is PrecompileConsumer {
    uint256 public nextDraftId;
    mapping(uint256 => address) public draftAuthor;
    mapping(uint256 => string) public draftContent;
    mapping(address => uint256[]) public userDrafts;

    event DraftGenerated(uint256 indexed id, address indexed author, string content);
    event DraftRequested(uint256 indexed id, address indexed author);

    function generateDraft(bytes calldata llmInput) external {
        uint256 id = nextDraftId;
        nextDraftId = id + 1;
        draftAuthor[id] = msg.sender;
        userDrafts[msg.sender].push(id);
        emit DraftRequested(id, msg.sender);

        bytes memory output = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);
        string memory content = _extractContent(output);
        draftContent[id] = content;
        emit DraftGenerated(id, msg.sender, content);
    }

    function _extractContent(bytes memory output) internal pure returns (string memory) {
        (, bytes memory actual) = abi.decode(output, (bytes, bytes));
        (bool err, bytes memory data, , string memory msg_) = abi.decode(actual, (bool, bytes, bytes, string));
        if (err) revert(string.concat("LLM: ", msg_));

        (, , , , , , uint256 n, bytes[] memory ch, ) =
            abi.decode(data, (string, string, uint256, string, string, string, uint256, bytes[], bytes));
        if (n == 0) return "No content";

        (, , bytes memory md) = abi.decode(ch[0], (uint256, string, bytes));
        (, string memory c, , , ) = abi.decode(md, (string, string, string, uint256, bytes[]));
        return c;
    }

    function getDraft(uint256 id) external view returns (address, string memory) {
        return (draftAuthor[id], draftContent[id]);
    }

    function getUserDrafts(address user) external view returns (uint256[] memory) {
        return userDrafts[user];
    }
}
