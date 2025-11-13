// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedVaultRegistry {
    struct RecordMeta {
        address owner;
        bytes32 hash;      // SHA-256 of encrypted record
        uint256 createdAt;
    }

    // hash -> metadata
    mapping(bytes32 => RecordMeta) public records;

    // hash -> doctor -> approved
    mapping(bytes32 => mapping(address => bool)) public accessApproved;

    event RecordStored(bytes32 indexed hash, address indexed owner);
    event DoctorApproved(bytes32 indexed hash, address indexed doctor);

    function storeRecord(bytes32 recordHash) external {
        require(records[recordHash].createdAt == 0, "Record already exists");
        records[recordHash] = RecordMeta({
            owner: msg.sender,
            hash: recordHash,
            createdAt: block.timestamp
        });
        emit RecordStored(recordHash, msg.sender);
    }

    function approveDoctor(bytes32 recordHash, address doctor) external {
        require(records[recordHash].owner == msg.sender, "Only owner");
        accessApproved[recordHash][doctor] = true;
        emit DoctorApproved(recordHash, doctor);
    }

    function hasAccess(bytes32 recordHash, address user) external view returns (bool) {
        if (records[recordHash].owner == user) return true;
        return accessApproved[recordHash][user];
    }
}
